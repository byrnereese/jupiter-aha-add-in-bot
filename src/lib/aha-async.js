const loadProducts = ( aha ) => {
    console.log(`WORKER: loading products`)
    // TODO - loadProducts needs to iterate over a number of pages, compile a complete list
    // and then resolve the promise
    const promise = new Promise( (resolve, reject) => {
        aha.product.list( function (err, data, response) {
            resolve( data )
        })
    })
    console.log("WORKER: returning from loadProducts")
    return promise
}
exports.loadProducts = loadProducts;
