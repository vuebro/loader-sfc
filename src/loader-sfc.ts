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
import { ofetch } from "ofetch";
import { transform } from "sucrase";
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
} from "vue/compiler-sfc";

/**
 * Fetches content from a given input URL
 *
 * @param {string} input The URL or file path to fetch
 * @returns {Promise<string | undefined>} The content of the file or undefined
 *   if there was an error
 */
const fetching = async (input: string) => {
    try {
      return await ofetch(input, { responseType: "text" });
    } catch (error) {
      consola.error(error);
    }
    return;
  },
  /**
   * Dynamically imports JavaScript code by creating an object URL
   *
   * @param {string} code The JavaScript code to inject and import
   * @returns {Promise<Record<string, object>>} The imported module as a record
   *   of objects
   */
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

/**
 * Loads and compiles a Vue SFC file dynamically in the browser
 *
 * @param {string} filename The path or URL to the .vue file to load
 * @param {object} [options] Configuration options for parsing, scripting, and
 *   styling
 * @param {Partial<SFCParseOptions>} [options.parseOptions] Options for parsing
 *   the SFC
 * @param {Partial<SFCScriptCompileOptions>} [options.scriptOptions] Options for
 *   compiling the script section
 * @param {Partial<SFCTemplateCompileOptions>} [options.scriptOptions.templateOptions]
 *   Options for compiling the template
 * @param {CompilerOptions} [options.scriptOptions.templateOptions.compilerOptions]
 *   Compiler options
 * @param {ParserPlugin[]} [options.scriptOptions.templateOptions.compilerOptions.expressionPlugins]
 *   Expression plugins to use
 * @param {Partial<SFCAsyncStyleCompileOptions>} [options.styleOptions] Options
 *   for compiling the style sections
 * @returns {Promise<object>} A compiled Vue component object
 */
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
  let styleWarning = "";

  const id = `data-v-${hash(filename)}`,
    styleErrors: Error[] = [],
    { descriptor, errors: parseErrors } = parse(
      (await fetching(filename)) ?? "<template></template>",
      { filename, ...parseOptions },
    ),
    { script, scriptSetup, slotted, styles, template } = descriptor;

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
    compilerOptions: CompilerOptions = {
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
    style = !(document.getElementById(id) instanceof HTMLStyleElement)
      ? Promise.all(
          styles.map(async ({ content, module, scoped = false, src }) => {
            const modules = !!module;
            if (modules && !styleWarning) {
              styleWarning =
                "<style module> is not supported in the playground.";
              return "";
            } else {
              const { code, errors } = await compileStyleAsync({
                filename,
                id,
                modules,
                scoped,
                source: src ? ((await fetching(src)) ?? "") : content,
                ...styleOptions,
              });
              styleErrors.push(...errors);
              return code;
            }
          }),
        )
      : Promise.resolve([]),
    sucraseOptions: Options = {
      jsxRuntime: "preserve",
      transforms: [...langs] as Transform[],
    },
    { ast, content: source = "" } = template ?? {},
    {
      bindings,
      content,
      warnings: scriptWarnings,
    } = script || scriptSetup ? compileScript(descriptor, scriptOptions) : {};

  if (bindings) compilerOptions.bindingMetadata = bindings;

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

  const [styleResult, scriptResult, templateResult] = await Promise.all([
      style,
      content
        ? inject(langs.size ? transform(content, sucraseOptions).code : content)
        : Promise.resolve(undefined),
      code
        ? inject(langs.size ? transform(code, sucraseOptions).code : code)
        : Promise.resolve(undefined),
    ]),
    textContent = styleResult.join("\n").trim();

  if (textContent) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = textContent;
    document.head.appendChild(el);
  }

  return { __scopeId: id, ...scriptResult?.["default"], ...templateResult };
};
