module.exports = {  
    entry: './app.js',
    output: {
        filename: './app-bundle.js'
    },
    module: {
        loaders: [
            { test: /\.html$/, loader: 'ractive-component-loader' }
        ]
    }
};
