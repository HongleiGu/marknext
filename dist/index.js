
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./marknext.cjs.production.min.js')
} else {
  module.exports = require('./marknext.cjs.development.js')
}
