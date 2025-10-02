import type { SFCTemplateCompileOptions } from "@vue/compiler-sfc";
import type { Options } from "sucrase";
import type { Component } from "vue";

import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
} from "@vue/compiler-sfc";
import hash from "hash-sum";
import { transform } from "sucrase";

const log = (msgs: (Error | string)[]) => {
    msgs.forEach((msg) => {
      console.log(msg);
    });
  },
  options: Options = {
    jsxRuntime: "preserve",
    transforms: ["jsx", "typescript"],
  };

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
      value = (await import(objectURL)) as Component;
    URL.revokeObjectURL(objectURL);
    return value;
  },
  loadModule = async (filename: string) => {
    const id = hash(filename),
      { descriptor, errors } = parse(
        (await (await fetchText(filename)).text()) || "<template></template>",
      ),
      { script, scriptSetup, slotted, styles, template } = descriptor;
    const templateOptions: Partial<SFCTemplateCompileOptions> = {
      compilerOptions: {
        expressionPlugins: ["jsx", "typescript"],
      },
      scoped: styles.some(({ scoped }) => scoped),
      slotted,
    };
    log(errors);

    let el = document.getElementById(id);
    if (!(el instanceof HTMLStyleElement)) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = (
      await Promise.all(
        styles.map(async ({ content, module, scoped = false, src }) => {
          const { code, errors } = await compileStyleAsync({
            filename,
            id,
            modules: !!module,
            scoped,
            source: src ? await (await fetchText(src)).text() : content,
          });
          log(errors);
          return code;
        }),
      )
    ).join("\n");

    if (script || scriptSetup) {
      const { content, warnings = [] } = compileScript(descriptor, {
        id,
        ...(template ? templateOptions : {}),
      });
      log(warnings);
      return inject(transform(content, options).code);
    } else if (template) {
      const { content: source } = template;
      const { code, errors, tips } = compileTemplate({
        ...templateOptions,
        filename,
        id,
        source,
      });
      log(errors);
      log(tips);
      return inject(transform(code, options).code);
    } else return {};
  };
export default loadModule;
