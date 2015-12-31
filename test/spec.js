var q = require("../q.js");

module.exports = {
	deferred: function(resolver) {
		var p = q(resolver);
		p.promise = p;
		return p;
	}
};
