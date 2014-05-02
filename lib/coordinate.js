function Coordinate (c) {
  if (!(this instanceof Coordinate)) { return new Coordinate(c); }
  this.x = c.x;
  this.y = c.y;
}
Coordinate.prototype.add = function (other) {
  return Coordinate.add(this, other);
};
Coordinate.prototype.subtract = function (other) {
  return Coordinate.subtract(this, other);
};

Coordinate.pointwise = function (fn) {
  return function (one, two) {
    return Coordinate({
      x: fn(one.x, two.x),
      y: fn(one.y, two.y)
    });
  };
};
Coordinate.add = Coordinate.pointwise(function (left, right) { return left + right; });
Coordinate.subtract = Coordinate.pointwise(function (left, right) { return left - right; });
Coordinate.min = Coordinate.pointwise(Math.min);
Coordinate.max = Coordinate.pointwise(Math.max);

Coordinate.lt = function (self, other) {
  return self.x < other.x && self.y < other.y;
};
Coordinate.lte = function (self, other) {
  return self.x <= other.x && self.y <= other.y;
};

Coordinate.within = function (c, cornerOne, cornerTwo) {
  var topLeft = Coordinate.min(cornerOne, cornerTwo);
  var bottomRight = Coordinate.max(cornerOne, cornerTwo);
  return Coordinate.lte(topLeft, c) && Coordinate.lt(c, bottomRight);
};

Coordinate.infinity = function () { return Coordinate({x: Infinity, y: Infinity}); };
Coordinate.origin = function () { var c = Coordinate({x: 0, y: 0}); c.load = true; return c; };
Coordinate.setter = function (upper, lower) {
  upper = upper || Coordinate.infinity;
  lower = lower || Coordinate.origin;
  return function (c) {
    var upperC = upper.apply(this, arguments);
    var lowerC = lower.call(this, arguments);
    return Coordinate.max(Coordinate.min(c, upperC), lowerC);
  };
};

Coordinate.linear = {
  cmp: function (left, right) {
    if (left.y < right.y) { return -1; }
    if (left.y > right.y) { return 1; }
    // Same line from this point on

    if (left.x < right.x) { return -1; }
    if (left.x > right.x) { return 1; }
    return 0;
  },
  within: function (c, start, end) {
    return Coordinate.linear.cmp(start, c) < 1 && Coordinate.linear.cmp(c, end) < 1;
  }
};

module.exports = Coordinate;
