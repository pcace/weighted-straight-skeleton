const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

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
		plugins: [new CleanWebpackPlugin()],
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
