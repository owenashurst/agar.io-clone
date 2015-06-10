var vectorizeText = require("vectorize-text")

module.exports.vectorize = function(toVectorize, options){
	return vectorizeText(toVectorize, options);
};
