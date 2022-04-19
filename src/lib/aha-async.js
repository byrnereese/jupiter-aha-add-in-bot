const loadProducts = async (aha) => {
    console.log("In loadProducts()")
    const getProductPage = (page) => {
        return new Promise((resolve, reject) => {
            aha.product.list(function (err, data, response) {
                var isLastPage = (data.pagination.current_page == data.pagination.total_pages ? true : false)
                resolve([data, isLastPage])
            }, `page=${page}`)
        })
    };
    return new Promise((resolve, reject) => {
        const loop = (page, results) => {
            if (!page) { page = 1 }
            if (!results) { results = [] }
            getProductPage( page ).then( ([response, isLastPage]) => {
                console.log(`is last page? ${isLastPage}`)
                if (isLastPage) {
                    resolve( results.concat( response.products ) )
                } else {
                    return loop( page + 1, results.concat( response.products ) )
                }
            })
        }
        loop()
    })
}
exports.loadProducts = loadProducts;
