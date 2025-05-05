const path = require("node:path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = [
	{
		entry: "./src/wrapper/index.ts",
		output: {
			filename: "./index.js",
			path: path.resolve(__dirname, "dist"),
			library: {
				type: "umd",
			},
		},
		devtool: "source-map",
		plugins: [new CleanWebpackPlugin(), new NodePolyfillPlugin()],
		module: {
			rules: [
				{
					test: /\.ts|.tsx$/,
					loader: "ts-loader",
					exclude: /node_modules/,
					options: { configFile: "tsconfig.build.json" },
				},
			],
		},
		resolve: {
			extensions: [".ts", ".js"],
		},
	},
	{
		// Node.js build
		entry: "./src/wrapper/index.ts",
		output: {
			filename: "./index.node.js",
			path: path.resolve(__dirname, "dist"),
			library: {
				type: "commonjs2",
			},
		},
		target: "node",
		devtool: "source-map",
		module: {
			rules: [
				{
					test: /\.ts|.tsx$/,
					loader: "ts-loader",
					exclude: /node_modules/,
					options: { configFile: "tsconfig.build.json" },
				},
			],
		},
		resolve: {
			extensions: [".ts", ".js"],
		},
	},
];
