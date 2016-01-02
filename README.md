<a href="https://promisesaplus.com/"><img src="https://promisesaplus.com/assets/logo-small.png" align="right" /></a>
Q — library for promises
==================================================

[Promise/A+](https://promisesaplus.com/) is the specification what this implementation follow. It can be used in any allowed way under Promise/A+.

This implementation is quite small, and it is easy to merge into other code without introduction of redundant code. This is very helpful when developing a webapp.

Environments in which to use Q
--------------------------------------------------

-Browser support
-Nodejs
-Browser extensions

Runing the Unit Tests
--------------------------------------------------

You need the necessary dependencies:

```sh
npm install
```

Run tests

```sh
npm test
```

Tutorial
-------------------------------------------------

```js
Q(function(resolve, reject) {
    // Async or sync operation
    // success: resolve(val)
    // error: reject(reason)
}).then(function(val) {
    // onresolved
}, function(reason) {
    // onrejected
});
```


License
-------------------------------------------------

Copyright 2015–2016 Xiao-Bo Li MIT License