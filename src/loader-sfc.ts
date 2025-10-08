import type { ParserPlugin } from "@babel/parser";
import type { Options, Transform } from "sucrase";
import type { Component } from "vue";
import type {
  CompilerOptions,
  SFCAsyncStyleCompileOptions,
  SFCParseOptions,
  SFCScriptCompileOptions,
  SFCTemplateCompileOptions,
} from "vue/compiler-sfc";

import hash from "hash-sum";
import { transform } from "sucrase";
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
} from "vue/compiler-sfc";

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
  const styleErrors: Error[] = [],
    { descriptor, errors: parseErrors } = parse(
      (await (await fetchText(filename)).text()) || "<template></template>",
      parseOptions,
    ),
    { script, scriptSetup, slotted, styles, template } = descriptor;
  let moduleWarning = "";
  const id = `data-v-${hash(filename)}`,
    langs = new Set(
      [script, scriptSetup].flatMap((scriptBlock) => {
        const { lang = "js" } = scriptBlock ?? {};
        return [
          ...(/[jt]sx$/.test(lang) ? ["jsx"] : []),
          ...(/tsx?$/.test(lang) ? ["typescript"] : []),
        ] as ParserPlugin[];
      }),
    ),
    compilerOptions: CompilerOptions = {
      expressionPlugins: [
        ...new Set([...(expressionPlugins ?? []), ...langs]),
      ] as ParserPlugin[],
      scopeId: id,
      slotted,
      ...restCompilerOptions,
    },
    scoped = styles.some(({ scoped }) => scoped),
    component: Component = scoped ? { __scopeId: id } : {},
    templateOptions: Partial<SFCTemplateCompileOptions> = {
      compilerOptions,
      scoped,
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
            if (modules) {
              moduleWarning =
                "<style module> is not supported in the playground.";
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
  Object.assign(component, scriptResult?.default);
  Object.assign(component, templateResult);
  [
    ...parseErrors,
    ...(scriptWarnings ?? []),
    ...(templateTips ?? []),
    ...(templateErrors ?? []),
    ...styleErrors,
    ...(moduleWarning ? [moduleWarning] : []),
  ].forEach((msg) => {
    console.log(msg);
  });
  return component;
};
