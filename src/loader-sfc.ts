import type { Options, Transform } from "sucrase";
import type { Component } from "vue";
import type { CompilerOptions } from "vue/compiler-sfc";

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

export default async (filename: string) => {
  const id = `data-v-${hash(filename)}`,
    langs = new Set(),
    { descriptor, errors: alerts } = parse(
      (await (await fetchText(filename)).text()) || "<template></template>",
    ),
    { script, scriptSetup, slotted, styles, template } = descriptor;

  [script, scriptSetup].forEach((scriptBlock) => {
    const { lang = "js" } = scriptBlock ?? {};
    if (/[jt]sx$/.test(lang)) langs.add("jsx");
    if (/tsx?$/.test(lang)) langs.add("typescript");
  });

  const compilerOptions: CompilerOptions = {
      expressionPlugins: [...langs] as ("jsx" | "typescript")[],
      scopeId: id,
      slotted,
    },
    scoped = styles.some(({ scoped }) => scoped),
    component: Component = scoped ? { __scopeId: id } : {},
    options: Options = {
      jsxRuntime: "preserve",
      transforms: [...langs] as Transform[],
    },
    style = !(document.getElementById(id) instanceof HTMLStyleElement)
      ? Promise.all(
          styles.map(
            async ({ content, module = false, scoped = false, src }) => {
              const { code, errors } = await compileStyleAsync({
                filename,
                id,
                scoped,
                source: src ? await (await fetchText(src)).text() : content,
              });
              if (module)
                errors.push(
                  Error("<style module> is not supported in the playground."),
                );
              alerts.push(...errors);
              return code;
            },
          ),
        )
      : Promise.resolve([]),
    { ast, content: source } = template ?? {},
    { bindings, content, warnings } =
      script || scriptSetup ? compileScript(descriptor, { id }) : {};
  if (source && bindings) compilerOptions.bindingMetadata = bindings;
  const { code, errors, tips } =
    source !== undefined
      ? compileTemplate({
          ...(ast ?? {}),
          compilerOptions,
          filename,
          id,
          scoped,
          slotted,
          source,
        })
      : {};
  const [styleResult, scriptResult, templateResult] = await Promise.all([
      style,
      content
        ? inject(langs.size ? transform(content, options).code : content)
        : Promise.resolve(undefined),
      code
        ? inject(langs.size ? transform(code, options).code : code)
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
  [...alerts, ...(warnings ?? []), ...(tips ?? []), ...(errors ?? [])].forEach(
    (msg) => {
      console.log(msg);
    },
  );
  return component;
};
