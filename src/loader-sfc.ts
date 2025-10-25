import type {
  SFCAsyncStyleCompileOptions,
  SFCTemplateCompileOptions,
  SFCScriptCompileOptions,
  CompilerOptions,
  SFCParseOptions,
} from "vue/compiler-sfc";
import type { ParserPlugin } from "@babel/parser";
import type { Transform, Options } from "sucrase";

import {
  compileStyleAsync,
  compileTemplate,
  compileScript,
  parse,
} from "vue/compiler-sfc";
import { consola } from "consola/browser";
import { transform } from "sucrase";
import { ofetch } from "ofetch";
import hash from "hash-sum";

/* -------------------------------------------------------------------------- */
/*                              Служебные функции                             */
/* -------------------------------------------------------------------------- */

const inject = async (code: string) => {
    const objectURL = URL.createObjectURL(
      new Blob([code], { type: "application/javascript" }),
    );
    try {
      return (await import(objectURL)) as Record<string, object>;
    } finally {
      URL.revokeObjectURL(objectURL);
    }
  },
  fetching = async (input: string) => {
    try {
      return await ofetch(input);
    } catch (error) {
      consola.error(error);
    }
  };

/* -------------------------------------------------------------------------- */
/*                  Функция загрузки файла с компонентом Vue                  */
/* -------------------------------------------------------------------------- */

export default async (
  filename: string,
  {
    scriptOptions: {
      templateOptions: {
        compilerOptions: { expressionPlugins, ...restCompilerOptions } = {},
        ...restTemplateOptions
      } = {},
      ...restScriptOptions
    } = {},
    parseOptions,
    styleOptions,
  }:
    | {
        styleOptions?: Partial<SFCAsyncStyleCompileOptions>;
        scriptOptions?: Partial<SFCScriptCompileOptions>;
        parseOptions?: Partial<SFCParseOptions>;
      }
    | undefined = {},
) => {
  /* -------------------------------------------------------------------------- */
  /*                    Генерация уникального идентификатора                    */
  /* -------------------------------------------------------------------------- */

  const id = `data-v-${hash(filename)}`;

  /* -------------------------------------------------------------------------- */
  /*                 Загрузка и парсинг файла с компонентом Vue                 */
  /* -------------------------------------------------------------------------- */

  const { errors: parseErrors, descriptor } = parse(
    (await fetching(filename)) ?? "<template></template>",
    { filename, ...parseOptions },
  );

  /* -------------------------------------------------------------------------- */
  /*                         Обработка полученных данных                        */
  /* -------------------------------------------------------------------------- */

  const { scriptSetup, template, slotted, script, styles } = descriptor;
  const langs = new Set(
      [script, scriptSetup]
        .filter((scriptBlock) => scriptBlock !== null)
        .flatMap(
          ({ lang = "js" }) =>
            [
              ...(/[jt]sx$/.test(lang) ? ["jsx"] : []),
              ...(/tsx?$/.test(lang) ? ["typescript"] : []),
            ] as ParserPlugin[],
        ),
    ),
    { content: source = "", ast } = template ?? {};

  /* -------------------------------------------------------------------------- */
  /*                      Загрузка и компилирование стилей                      */
  /* -------------------------------------------------------------------------- */

  let styleWarning = "";
  const styleErrors: Error[] = [];
  const style = !(document.getElementById(id) instanceof HTMLStyleElement)
    ? Promise.all(
        styles.map(async ({ scoped = false, content, module, src }) => {
          const modules = !!module;
          if (modules && !styleWarning) {
            styleWarning = "<style module> is not supported in the playground.";
            return "";
          } else {
            const { errors, code } = await compileStyleAsync({
              source: src ? ((await fetching(src)) ?? "") : content,
              filename,
              modules,
              scoped,
              id,
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
      scopeId: id,
      filename,
      slotted,
      ...restCompilerOptions,
    },
    templateOptions: Partial<SFCTemplateCompileOptions> = {
      scoped: styles.some(({ scoped }) => scoped),
      compilerOptions,
      filename,
      slotted,
      id,
      ...restTemplateOptions,
    },
    scriptOptions: SFCScriptCompileOptions = {
      templateOptions,
      id,
      ...restScriptOptions,
    },
    sucraseOptions: Options = {
      transforms: [...langs] as Transform[],
      jsxRuntime: "preserve",
    };

  /* -------------------------------------------------------------------------- */
  /*                             Компиляция скрипта                             */
  /* -------------------------------------------------------------------------- */

  const {
    warnings: scriptWarnings,
    bindings,
    content,
  } = script || scriptSetup ? compileScript(descriptor, scriptOptions) : {};

  /* -------------------------------------------------------------------------- */
  /*                            Связывание метаданных                           */
  /* -------------------------------------------------------------------------- */

  if (bindings) compilerOptions.bindingMetadata = bindings;

  /* -------------------------------------------------------------------------- */
  /*                             Компиляция шаблона                             */
  /* -------------------------------------------------------------------------- */

  const {
    errors: templateErrors,
    tips: templateTips,
    code,
  } = template && (!scriptSetup || !scriptOptions.inlineTemplate)
    ? compileTemplate({
        ...ast,
        filename,
        source,
        id,
        ...templateOptions,
      })
    : {};

  /* -------------------------------------------------------------------------- */
  /*                  Вывод ошибок, предупреждений и подсказок                  */
  /* -------------------------------------------------------------------------- */

  [...parseErrors, ...(templateErrors ?? []), ...styleErrors].forEach(
    (error) => {
      consola.error(error);
    },
  );
  [...(scriptWarnings ?? []), ...(styleWarning ? [styleWarning] : [])].forEach(
    (warn) => {
      consola.warn(warn);
    },
  );
  [...(templateTips ?? [])].forEach((info) => {
    consola.info(info);
  });

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

  return { __scopeId: id, ...scriptResult?.["default"], ...templateResult };
};
