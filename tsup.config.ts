import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"lib/ged-to-gno": "src/lib/ged-to-gno.ts",
		"lib/gno-to-ged": "src/lib/gno-to-ged.ts",
		"cli-ged-to-gno": "src/cli-ged-to-gno.ts",
		"cli-gno-to-ged": "src/cli-gno-to-ged.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	treeshake: true,
	minify: false,
});
