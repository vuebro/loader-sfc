import type { Options } from "sucrase";
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
      ),
      value = (await import(objectURL)) as Record<string, object>;

    URL.revokeObjectURL(objectURL);

    return value;
  },
  log = (msgs: (Error | string)[]) => {
    msgs.forEach((msg) => {
      console.log(msg);
    });
  },
  options: Options = {
    jsxRuntime: "preserve",
    transforms: ["jsx", "typescript"],
  };

/* -------------------------------------------------------------------------- */

export default async (filename: string) => {
  const id = `data-v-${hash(filename)}`,
    { descriptor, errors } = parse(
      (await (await fetchText(filename)).text()) || "<template></template>",
    ),
    { script, scriptSetup, slotted, styles, template } = descriptor;

  log(errors);

  const compilerOptions: CompilerOptions = {
      expressionPlugins: ["jsx", "typescript"],
      scopeId: id,
      slotted,
    },
    scoped = styles.some(({ scoped }) => scoped),
    component: Component = scoped ? { __scopeId: id } : {};

  if (!(document.getElementById(id) instanceof HTMLStyleElement)) {
    const warnings = new Set<string>();

    const textContent = (
      await Promise.all(
        styles.map(async ({ content, module, scoped = false, src }) => {
          const { code, errors } = await compileStyleAsync({
            filename,
            id,
            scoped,
            source: src ? await (await fetchText(src)).text() : content,
          });

          if (module)
            warnings.add("<style module> is not supported in the playground.");

          log(errors);

          return code;
        }),
      )
    )
      .join("\n")
      .trim();

    if (textContent) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = textContent;
      document.head.appendChild(el);
    }

    log([...warnings]);
  }

  if (script || scriptSetup) {
    const {
      bindings,
      content,
      warnings = [],
    } = compileScript(descriptor, { id });

    if (template && bindings) compilerOptions.bindingMetadata = bindings;
    Object.assign(
      component,
      (await inject(transform(content, options).code)).default,
    );

    log(warnings);
  }

  if (template) {
    const { ast, content: source } = template,
      { code, errors, tips } = compileTemplate({
        ...(ast && { ast }),
        compilerOptions,
        filename,
        id,
        scoped,
        slotted,
        source,
      });

    Object.assign(component, await inject(transform(code, options).code));

    log(tips);
    log(errors);
  }

  return component;
};
