//var word = /[^\s.\(\){}\[\]]+/g
var word = /\w+/g

exports.prev = prev
exports.next = next
exports.current = current
exports.wordEnd = wordEnd

function prev(string, i, r) {
  r = r || word
  r.lastIndex = 0
  r.global = true

  var _m = null, m = null
  do { 
    _m = m
    m = r.exec(string)
  } while (m && m.index < i);

  if(!m || m.index >= i) return _m
  return m
}

function next (string, i, r) {
  r = r || word
  r.lastIndex = i
  r.global = true

  var _m = null, m = null
  do {
    m = r.exec(string)
    if(!m) return _m
    _m = m
  } while (m && m.index > i);

  return r.exec(string)
}

function current (string, i, r) {
  r = r || word
  r.lastIndex = i
  r.global = true
  var m
  do {
    m = r.exec(string)
    if(!m) return null
    //take the first match ends after this position.
    //console.error(m, i, '<', m.index + m[0].length)
    if(i < m.index + m[0].length)
      return m
  } while (m);

}

function wordEnd (string, i, r) {
  var m = current(string, i, r)
  return m && m.index + m[0].length
}
