# Vue SFC Loader

Vue3 Single File Component (SFC) loader. Load .vue files directly from your browser without any build step.

## Installation

Install `@vuebro/loader-sfc` with npm

```bash
npm install @vuebro/loader-sfc
```

## Usage/Examples

[Documentation oт Async Components](https://vuejs.org/guide/components/async)

To load .vue files dynamically at runtime just use loadModule function:

```javascript
<script setup>
import { defineAsyncComponent } from "vue";
import loadModule from "@vuebro/loader-sfc";

const AdminPage = defineAsyncComponent(() =>
  loadModule('./components/AdminPageComponent.vue')
);
</script>

<template>
  <AdminPage />
</template>
```

A simple example of using `@vuebro/loader-sfc` in a template Vue 3 + TypeScript + Vite application for dynamic loading and compilation of an SFC module during application runtime in the browser can be found in the repository: [loader-sfc-example](https://github.com/vuebro/loader-sfc-example)
