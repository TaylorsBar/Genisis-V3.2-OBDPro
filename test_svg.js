function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeArcSegment(x, y, rIn, rOut, startAngle, endAngle) {
    const p1 = polarToCartesian(x, y, rOut, endAngle);
    const p2 = polarToCartesian(x, y, rOut, startAngle);
    const p3 = polarToCartesian(x, y, rIn, startAngle);
    const p4 = polarToCartesian(x, y, rIn, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", p1.x, p1.y,
        "A", rOut, rOut, 0, largeArcFlag, 0, p2.x, p2.y,
        "L", p3.x, p3.y,
        "A", rIn, rIn, 0, largeArcFlag, 1, p4.x, p4.y,
        "Z"
    ].join(" ");
}

console.log(describeArcSegment(200, 200, 140, 150, -45, 45));
