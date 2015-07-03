console.log('\n\n' + __dirname + '\n\n');
module.exports = {
    entry: "./client/js/app.js",
    output: {
        path: require("path").resolve("./bin/client/js"),
        library: "app",
        filename: "app.js"
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel'
            }
        ]
    }
};
