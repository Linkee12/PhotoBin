const IntroImg = ({
  firstText,
  secondText,
  ...props
}: React.SVGProps<SVGSVGElement> & { firstText: string; secondText: string }) => (
  <svg
    width={500}
    height={200}
    viewBox="0 0 264.71527 93.359299"
    id="svg1"
    xmlSpace="preserve"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    xmlns="http://www.w3.org/2000/svg"
    {...props} // Itt már a firstText és secondText nincsenek benne
  >
    <defs id="defs1">
      <linearGradient id="linearGradient79">
        <stop
          style={{
            stopColor: "#ffa021",
            stopOpacity: 1,
          }}
          offset={0.13681495}
          id="stop77"
        />
        <stop
          style={{
            stopColor: "#9d6e2f",
            stopOpacity: 1,
          }}
          offset={0.13681495}
          id="stop78"
        />
        <stop
          style={{
            stopColor: "#ffffff",
            stopOpacity: 1,
          }}
          offset={1}
          id="stop79"
        />
      </linearGradient>
    </defs>
    <g id="layer1" transform="translate(562.54175,-175.5984)">
      <text
        xmlSpace="preserve"
        style={{
          fontSize: 10,
          lineHeight: 1.25,
          fontFamily: "sans-serif",
          textAlign: "center",
          textAnchor: "middle",
          fill: "#333333",
        }}
        x={-445.91898}
        y={194.13223}
        id="text79"
      >
        <tspan
          id="tspan79"
          x={-445.91898}
          y={194.13223}
          style={{
            fontSize: 10,
            fill: "#333333",
          }}
        >
          {firstText}
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        style={{
          fontSize: 10,
          lineHeight: 1.25,
          fontFamily: "sans-serif",
          textAlign: "center",
          textAnchor: "middle",
          fill: "#333333",
        }}
        x={-338.73135}
        y={193.49733}
        id="text79-9"
      >
        <tspan
          id="tspan79-0"
          x={-338.73135}
          y={193.49733}
          style={{
            fontSize: 10,
            fill: "#333333",
          }}
        >
          {secondText}
        </tspan>
      </text>
    </g>
  </svg>
);

export default IntroImg;
