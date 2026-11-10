/* Indexed subtitle matching, including overlapping tracks and nearest-cue ties. */
(function (root) {
  function upperBound(cues, time) {
    var low = 0, high = cues.length;
    while (low < high) {
      var middle = (low + high) >>> 1;
      if (Number(cues[middle].start) <= time) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  function secondaryMatcher(cues) {
    var ends = [], indices = [], bestEnd = -Infinity, bestIndex = -1;
    cues.forEach(function (cue, index) {
      var end = Number(cue.end);
      if (end > bestEnd) { bestEnd = end; bestIndex = index; }
      ends.push(bestEnd); indices.push(bestIndex);
    });
    return function (cue) {
      if (!cues.length) return "";
      var center = (Number(cue.start) + Number(cue.end)) / 2;
      var right = upperBound(cues, center), index = -1, distance = Infinity;
      if (right && ends[right - 1] >= center) {
        // The first prefix containing an overlap preserves the original tie rule.
        var low = 0, high = right - 1;
        while (low < high) {
          var middle = (low + high) >>> 1;
          if (ends[middle] >= center) high = middle;
          else low = middle + 1;
        }
        index = low; distance = 0;
      } else {
        if (right) { index = indices[right - 1]; distance = center - ends[right - 1]; }
        if (right < cues.length && Number(cues[right].start) - center < distance) {
          index = right; distance = Number(cues[right].start) - center;
        }
      }
      return index >= 0 && distance <= 2.4 ? String(cues[index].text || "") : "";
    };
  }
  var api = { secondaryMatcher: secondaryMatcher };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.smartCaptionTimeline = api;
}(typeof window !== "undefined" ? window : this));
