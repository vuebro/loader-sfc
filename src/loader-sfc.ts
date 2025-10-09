import type { ParserPlugin } from "@babel/parser";
import type { Options, Transform } from "sucrase";
import type {
  CompilerOptions,
  SFCAsyncStyleCompileOptions,
  SFCParseOptions,
  SFCScriptCompileOptions,
  SFCTemplateCompileOptions,
} from "vue/compiler-sfc";

import { consola } from "consola/browser";
import hash from "hash-sum";
import { transform } from "sucrase";
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
} from "vue/compiler-sfc";

/* -------------------------------------------------------------------------- */
/*                              Служебные функции                             */
/* -------------------------------------------------------------------------- */

const fetchText = async (url: string) => {
    try {
      const response = await fetch(url);
      return response.ok ? response : new Response("");
    } catch {
      return new Response("");
    }
  },
  inject = async (code: string) => {
    const objectURL = URL.createObjectURL(
      new Blob([code], { type: "application/javascript" }),
    );
    try {
      return (await import(objectURL)) as Record<string, object>;
    } finally {
      URL.revokeObjectURL(objectURL);
    }
  };

/* -------------------------------------------------------------------------- */
/*                  Функция загрузки файла с компонентом Vue                  */
/* -------------------------------------------------------------------------- */

export default async (
  filename: string,
  {
    parseOptions,
    scriptOptions: {
      templateOptions: {
        compilerOptions: { expressionPlugins, ...restCompilerOptions } = {},
        ...restTemplateOptions
      } = {},
      ...restScriptOptions
    } = {},
    styleOptions,
  }:
    | undefined
    | {
        parseOptions?: Partial<SFCParseOptions>;
        scriptOptions?: Partial<SFCScriptCompileOptions>;
        styleOptions?: Partial<SFCAsyncStyleCompileOptions>;
      } = {},
) => {
  /* -------------------------------------------------------------------------- */
  /*                    Генерация уникального идентификатора                    */
  /* -------------------------------------------------------------------------- */

  const id = `data-v-${hash(filename)}`;

  /* -------------------------------------------------------------------------- */
  /*                 Загрузка и парсинг файла с компонентом Vue                 */
  /* -------------------------------------------------------------------------- */

  const { descriptor, errors: parseErrors } = parse(
    (await (await fetchText(filename)).text()) || "<template></template>",
    { filename, ...parseOptions },
  );

  /* -------------------------------------------------------------------------- */
  /*                         Обработка полученных данных                        */
  /* -------------------------------------------------------------------------- */

  const { script, scriptSetup, slotted, styles, template } = descriptor;
  const langs = new Set(
      [script, scriptSetup].flatMap((scriptBlock) => {
        const { lang = "js" } = scriptBlock ?? {};
        return [
          ...(/[jt]sx$/.test(lang) ? ["jsx"] : []),
          ...(/tsx?$/.test(lang) ? ["typescript"] : []),
        ] as ParserPlugin[];
      }),
    ),
    { ast, content: source = "" } = template ?? {};

  /* -------------------------------------------------------------------------- */
  /*                      Загрузка и компилирование стилей                      */
  /* -------------------------------------------------------------------------- */

  let styleWarning;
  const styleErrors: Error[] = [];
  const style = !(document.getElementById(id) instanceof HTMLStyleElement)
    ? Promise.all(
        styles.map(async ({ content, module, scoped = false, src }) => {
          const modules = !!module;
          if (modules) {
            styleWarning = "<style module> is not supported in the playground.";
            return "";
          } else {
            const { code, errors } = await compileStyleAsync({
              filename,
              id,
              modules,
              scoped,
              source: src ? await (await fetchText(src)).text() : content,
              ...styleOptions,
            });
            styleErrors.push(...errors);
            return code;
          }
        }),
      )
    : Promise.resolve([]);

  /* -------------------------------------------------------------------------- */
  /*                             Подготовка настроек                            */
  /* -------------------------------------------------------------------------- */

  const compilerOptions: CompilerOptions = {
      expressionPlugins: [
        ...new Set([...(expressionPlugins ?? []), ...langs]),
      ] as ParserPlugin[],
      filename,
      scopeId: id,
      slotted,
      ...restCompilerOptions,
    },
    templateOptions: Partial<SFCTemplateCompileOptions> = {
      compilerOptions,
      filename,
      id,
      scoped: styles.some(({ scoped }) => scoped),
      slotted,
      ...restTemplateOptions,
    },
    scriptOptions: SFCScriptCompileOptions = {
      id,
      templateOptions,
      ...restScriptOptions,
    },
    sucraseOptions: Options = {
      jsxRuntime: "preserve",
      transforms: [...langs] as Transform[],
    };

  /* -------------------------------------------------------------------------- */
  /*                             Компиляция скрипта                             */
  /* -------------------------------------------------------------------------- */

  const {
    bindings,
    content,
    warnings: scriptWarnings,
  } = script || scriptSetup ? compileScript(descriptor, scriptOptions) : {};

  /* -------------------------------------------------------------------------- */
  /*                            Связывание метаданных                           */
  /* -------------------------------------------------------------------------- */

  if (bindings) compilerOptions.bindingMetadata = bindings;

  /* -------------------------------------------------------------------------- */
  /*                             Компиляция шаблона                             */
  /* -------------------------------------------------------------------------- */

  const {
    code,
    errors: templateErrors,
    tips: templateTips,
  } = template && (!scriptSetup || !scriptOptions.inlineTemplate)
    ? compileTemplate({
        ...ast,
        filename,
        id,
        source,
        ...templateOptions,
      })
    : {};

  /* -------------------------------------------------------------------------- */
  /*                  Вывод ошибок, предупреждений и подсказок                  */
  /* -------------------------------------------------------------------------- */

  consola.error(parseErrors, templateErrors, styleErrors);
  consola.warn(scriptWarnings, styleWarning);
  consola.info(templateTips);

  /* -------------------------------------------------------------------------- */
  /*                      Получение и обработка результатов                     */
  /* -------------------------------------------------------------------------- */

  const [styleResult, scriptResult, templateResult] = await Promise.all([
    style,
    content
      ? inject(langs.size ? transform(content, sucraseOptions).code : content)
      : Promise.resolve(undefined),
    code
      ? inject(langs.size ? transform(code, sucraseOptions).code : code)
      : Promise.resolve(undefined),
  ]);

  /* -------------------------------------------------------------------------- */
  /*                         Внедрение стилей в документ                        */
  /* -------------------------------------------------------------------------- */

  const textContent = styleResult.join("\n").trim();
  if (textContent) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = textContent;
    document.head.appendChild(el);
  }

  /* -------------------------------------------------------------------------- */
  /*                    Формирование возвращаемого компонента                   */
  /* -------------------------------------------------------------------------- */

  return { __scopeId: id, ...scriptResult?.default, ...templateResult };
};
