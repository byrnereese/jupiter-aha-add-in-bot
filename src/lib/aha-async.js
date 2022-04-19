const loadProducts = async (aha) => {
    console.log(`WORKER: loading workspaces`)
    let isLastPageReached = false;
    let currentPage = 1;
    let result = [];
    while (!isLastPageReached) {
        const promise = new Promise((resolve, reject) => {
            aha.product.list(function (err, data, response) {
                resolve(data)
            }, `page=${currentPage}`)
        })
        const productResponse = await promise;
        console.log(productResponse);
        result = result.concat(productResponse.products);
        if (productResponse.pagination.current_page !== productResponse.pagination.total_pages) {
            currentPage++;
            console.log(`WORKER: go to page:${currentPage}`)
        }
        else {
            isLastPageReached = true;
            console.log(`WORKER: last page reached`)
        }
        console.log("WORKER: returning from loadProducts")
    }
    return result;
}
exports.loadProducts = loadProducts;
