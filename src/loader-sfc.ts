import type { CompilerOptions } from "@vue/compiler-sfc";
import type { Options } from "sucrase";

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
      value = (await import(objectURL)) as Record<string, object>;
    URL.revokeObjectURL(objectURL);
    return value;
  },
  loadModule = async (filename: string) => {
    const compilerOptions: CompilerOptions = {
        expressionPlugins: ["jsx", "typescript"],
      },
      id = hash(filename),
      module: Record<string, object | string> = {},
      { descriptor, errors } = parse(
        (await (await fetchText(filename)).text()) || "<template></template>",
      ),
      { script, scriptSetup, slotted, styles, template } = descriptor;

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
      const {
        bindings,
        content,
        warnings = [],
      } = compileScript(descriptor, { id });
      log(warnings);
      if (bindings) compilerOptions.bindingMetadata = bindings;
      Object.assign(
        module,
        (await inject(transform(content, options).code)).default,
      );
    }

    if (template) {
      const { content: source } = template;
      const { code, errors, tips } = compileTemplate({
        compilerOptions,
        filename,
        id,
        scoped: styles.some(({ scoped }) => scoped),
        slotted,
        source,
      });
      log(errors);
      log(tips);
      Object.assign(module, await inject(transform(code, options).code));
    }

    return module;
  };
export default loadModule;
