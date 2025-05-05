const path = require("node:path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
		// plugins: [new CleanWebpackPlugin()],
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
            fallback: {
                // Just use empty modules instead of polyfills
                "path": false,
                "fs": false,
                "crypto": false,
                "stream": false,
                "buffer": false,
                "util": false,
            },


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
