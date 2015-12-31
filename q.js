/*
 * Q (Library for promises) v1.0.0
 * ---------------------------------------------------------
 *
 * Copyright 2015-2016 Xiao-Bo Li under the terms of the MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function(global, factory) {
	'use strict';

	if (typeof exports === "object" && typeof module === "object") {
		// function as a CJS module
		module.exports = factory();
	} else if (typeof define === "function" && define.amd) {
		// function as a AMD module
		define(factory);
	} else {
		// <script> or etc.
		// function as a Q global
		global.Q = factory();
	}

}(typeof window !== "undefined" ? window : this, function() {
	'use strict';

	// Function Reference: https://github.com/kriskowal/q
	var nextTick = (function() {
		var head = { // Singly-linked list
				task: void 0,
				next: null
			},
			tail = head,
			flushing = false,
			requestTick = void 0,
			isNodeJS = false;
		function flush() {
			while (head.next) {
				head = head.next;
				var task = head.task;
				head.task = void 0;
				var domain = head.domain;
				if (domain) {
					head.domain = void 0;
					domain.enter();
				}
				try {
					task();
				} catch (e) {
					if (isNodeJS) {
						// In node, uncaught exceptions are considered fatal errors.
						// Re-throw them synchronously to interrupt flushing!
						// Ensure continuation if the uncaught exception is suppressed
						// listening "uncaughtException" events (as domains does).
						// Continue in next event to avoid tick recursion.
						if (domain) {
							domain.exit();
						}
						setTimeout(flush, 0);
						if (domain) {
							domain.enter();
						}
						throw e;
					} else {
						// In browsers, uncaught exceptions are not fatal.
						// Re-throw them asynchronously to avoid slow-downs.
						setTimeout(function() {
							throw e;
						}, 0);
					}
				}
				if (domain) {
					domain.exit();
				}
			}
			flushing = false;
		}
		nextTick = function(task) {
			tail = tail.next = {
				task: task,
				domain: isNodeJS && process.domain,
				next: null
			};
			if (!flushing) {
				flushing = true;
				requestTick();
			}
		};
		if (typeof process !== "undefined" && process.nextTick) {
			// Ensure Q is in a real Node environment, with a `process.nextTick`.
			// To see through fake Node environments:
			// * Mocha test runner - exposes a `process` global without a `nextTick`
			// * Browserify - exposes a `process.nexTick` function that uses
			//   `setTimeout`. In this case `setImmediate` is preferred because
			//    it is faster. Browserify's `process.toString()` yields
			//   "[object Object]", while in a real Node environment
			//   `process.nextTick()` yields "[object process]".
			isNodeJS = true;
			requestTick = function() {
				process.nextTick(flush);
			};
		} else if (typeof setImmediate === "function") {
			// In IE10, Node.js 0.9+
			// https://github.com/NobleJS/setImmediate
			if (typeof window !== "undefined") {
				requestTick = setImmediate.bind(window, flush);
			} else {
				requestTick = function() {
					setImmediate(flush);
				};
			}
		} else if (typeof MessageChannel !== "undefined") {
			// modern browsers
			// http://www.nonblocking.io/2011/06/windownexttick.html
			var channel = new MessageChannel();
			// At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
			// working message ports the first time a page loads.
			channel.port1.onmessage = function() {
				requestTick = requestPortTick;
				channel.port1.onmessage = flush;
				flush();
			};
			var requestPortTick = function() {
				channel.port2.postMessage(0);
			};
			requestTick = function() {
				setTimeout(flush, 0);
				requestPortTick();
			};
		} else {
			// old browsers
			requestTick = function() {
				setTimeout(flush, 0);
			};
		}
		return nextTick;
	})();

	// Promise Closure
	return (function() {
		function Promise(resolver) {
			this.status = 0;
			this.val = null;
			this.pending = [];

			if (typeof resolver !== "undefined") {
				var that = this;
				if (typeof resolver === "function") {
					resolver(function(val) {
						that.exec(1, val);
					}, function(reason) {
						that.exec(2, reason);
					});
				} else {
					this.exec(1, resolver);
				}
			}
		}
		Promise.prototype = {
			then: function(onfulfilled, onrejected, onprogress) {
				var that, node, promise;
				// create sub promise
				promise = new Promise();
				node = [
					promise,
					onfulfilled,
					onrejected,
					onprogress
				];
				promise.node = node;

				if (this.status && !this.pending.length) {
					that = this;
					nextTick(function() {
						promise.exec(that.status, that.val);
					});
				} else {
					this.pending.push(node);
				}

				return promise;
			},
			exec: function(status, val) {
				if (this.status) { return this; }
				var that = this, then, lock, func;
				try {
					// resolve
					func = this.node && this.node[status];
					if (typeof func === "function") {
							val = func(val);
							status = 1;
					}
					// opt
					if (val === this) {
						throw new TypeError("val === promise");
					} else if (status === 1 && val instanceof Promise) {
						if (val.status && !val.pending.length) {
							nextTick(function() {
								that.node = null;
								that.exec(val.status, val.val);
							});
						} else {
							this.node = [this, null, null, null ];
							val.pending.push(this.node);
						}
					} else if ((typeof val === "object" ||
								typeof val === "function") &&
								status === 1 && val !== null && "then" in val) {
						try {
							then = val.then;
							if (typeof then === "function") {
								lock = 0;
								try {
									then.call(val, function resolvePromise(y) {
										if (lock === 0) {
											that.node = null;
											that.exec(1, y);
											lock = 1;
										}
									}, function rejectPromise(r) {
										if (lock === 0) {
											that.node = null;
											that.exec(2, r);
											lock = 1;
										}
									});
								} catch (e) {
									if (lock === 0) {
										throw e;
									}
								}
							} else {
								this.status = 1;
								this.val = val;
								this.dispatch();
							}
						} catch(e) {
							throw e;
						}
					} else if (typeof status !== "undefined") {
						this.status = status;
						this.val = val;
						this.dispatch();
					} else {
						throw new Error("Promise in unknown status.");
					}
				} catch (e) {
					this.status = 2;
					this.val = e;
					this.dispatch();
				}
				return this;
			},
			dispatch: function(nonFirst) {
				var that = this,
					node = this.pending.shift(),
					promise;
				if (node) {
					promise = node[0];
					nextTick(function() {
						promise.exec(that.status, that.val);
						that.dispatch(true);
					});
				} else if ((that.status === 2) && !nonFirst) {
					// Error uncaught will come here, and you can warn of the reason:
					// console.warn(that.val);
				}
			},
			resolve: function(val) { return this.exec(1, val); },
			reject: function(reason) { return this.exec(2, reason); },
			catch: function(onrejected) { return this.then(void 0, onrejected, void 0); },

			chain: chain,
			all: all,
			race: race
		};



		/**
		 * Q 
		 * to construct a promise
		 * 
		 * @param {Function|*} resolver
		 */
		return function Q(resolver) {
			return new Promise(resolver);
		};



		function chain() {
			var arr = arguments[0], p = this;
			(Array.isArray(arr) ||
				typeof arr === "array" ||
				(typeof arr === "object" && /array/i.test(({}).toString.call(arr)))) ||
					(arr = arguments);
			function exec(item) {
				if ((item && item.then && typeof item.then === "function") ||
					typeof item !== "function") {
					p = p.then(function(val) {
						return item;
					});
				} else {
					p = p.then(function(val) {
						while (typeof item === "function") {
							item = item(val);
						}
						return item;
					});
				}
			}
			for (var i = 0; i < arr.length; i++) {
				exec(arr[i]);
			}
			return p;
		}
		function all() {
			var arr = arguments[0];
			(Array.isArray(arr) ||
				typeof arr === "array" ||
				(typeof arr === "object" && /array/.test(({}).toString.call(arr)))) ||
					(arr = arguments);
			return this.then(function(val) {
				if (!arr.length) { return val; }
				var count = 0, p = new Promise();
				function exec(item, i, p) {
					if (item && item.then && typeof item.then === "function") {
						item.then(function(val) {
							count++;
							arr[i] = val;
							count >= arr.length && p.resolve(arr);
						}, function(reason) {
							p.reject(reason);
						});
					} else if (typeof item === "function") {
						// traverse
						exec((arr[i] = item(val)), i, p);
					} else {
						count++;
						count >= arr.length && p.resolve(arr);
					}
				}
				try {
					for (var i = 0, len = arr.length; i < len; i++) {
						exec(arr[i], i, p);
					}
				} catch (err) {
					p.reject(err);
				}
				return p;
			});
		}
		function race() {
			var arr = arguments[0];
			(Array.isArray(arr) ||
				typeof arr === "array" ||
				(typeof arr === "object" && /array/.test(({}).toString.call(arr)))) ||
					(arr = arguments);
			return this.then(function(val) {
				var p = new Promise(function(resolve, reject) {
					for (var i = 0; i < arr.length; i++) {
						var item = arr[i];
						if ((item && item.then && typeof item.then === "function") ||
							typeof item !== "function") {
							resolve(item);
						} else {
							while (typeof item === "function") {
								item = item();
							}
							resolve(item);
						}
					};
				});
				return p;
			});
		}
	}());

}));
