function coordinate (x, y) {
  return arguments.length === 1
    ? {x: x.x, y: x.y}
    : {x: x, y: y};
}
coordinate.pointwise = function (fn) {
  return function (one, two) {
    return {
      x: fn(one.x, two.x),
      y: fn(one.y, two.y)
    };
  };
};
coordinate.add = coordinate.pointwise(function (left, right) { return left + right; });
coordinate.subtract = coordinate.pointwise(function (left, right) { return left - right; });
coordinate.min = coordinate.pointwise(Math.min);
coordinate.max = coordinate.pointwise(Math.max);

coordinate.lt = function (self, other) {
  return self.x < other.x && self.y < other.y;
};
coordinate.lte = function (self, other) {
  return self.x <= other.x && self.y <= other.y;
};

coordinate.within = function (c, cornerOne, cornerTwo) {
  var topLeft = coordinate.min(cornerOne, cornerTwo);
  var bottomRight = coordinate.max(cornerOne, cornerTwo);
  return coordinate.lte(topLeft, c) && coordinate.lt(c, bottomRight);
};

coordinate.returnsInfinity = function () { return {x: Infinity, y: Infinity}; };
coordinate.returnsOrigin = function () { return {x: 0, y: 0}; };
coordinate.setter = function (upper, lower) {
  upper = upper || coordinate.returnsInfinity;
  lower = lower || coordinate.returnsOrigin;
  return function (c) {
    var upperC = upper.apply(this, arguments);
    var lowerC = lower.call(this, arguments);
    return coordinate.max(coordinate.min(c, upperC), lowerC);
  };
};

coordinate.linear = {
  cmp: function (left, right) {
    if (left.y < right.y) { return -1; }
    if (left.y > right.y) { return 1; }
    // Same line from this point on

    if (left.x < right.x) { return -1; }
    if (left.x > right.x) { return 1; }
    return 0;
  },
  within: function (c, start, end) {
    return coordinate.linear.cmp(start, c) < 1 && coordinate.linear.cmp(c, end) < 1;
  }
};

module.exports = coordinate;
