type CloudProps={height:number}
export const Cloud = (props:CloudProps) => (
  <svg
    viewBox="0 0 33.512779 24.319017"
    id="svg1"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <defs id="defs1">
      <mask id="progressMask">
        <rect x={0} y={0} width={640} height={480} fill="black" />
        <rect id="fillCloud" x={0} y={480 - props.height} width={640} height={props.height} fill="white" />
      </mask>
    </defs>
    <g id="layer1" transform="translate(-22.496719,-84.806527)">
      <g
        id="cloudOutline"
        style={{
          fill: "currentcolor",
          fillOpacity: 1,
          stroke: "none",
        }}
        transform="matrix(0.05216598,0,0,0.05216598,22.496719,83.137216)"
      >
        <title id="title3">{"Cloud Upload-alt"}</title>
        <path
          d="m 640,352 c 0,70.692 -57.308,128 -128,128 H 144 C 64.471,480 0,415.529 0,336 0,273.227 40.171,219.845 96.204,200.133 A 163.68,163.68 0 0 1 96,192 C 96,103.634 167.634,32 256,32 315.288,32 367.042,64.248 394.684,112.159 409.935,101.954 428.271,96 448,96 c 53.019,0 96,42.981 96,96 0,12.184 -2.275,23.836 -6.415,34.56 C 596.017,238.414 640,290.07 640,352 Z M 404.686,260.686 299.314,155.314 c -6.248,-6.248 -16.379,-6.248 -22.627,0 L 171.314,260.686 C 161.234,270.766 168.373,288 182.627,288 H 248 v 112 c 0,8.837 7.164,16 16,16 h 48 c 8.836,0 16,-7.163 16,-16 V 288 h 65.373 c 14.254,0 21.393,-17.234 11.313,-27.314 z"
          id="path3"
        />
      </g>
      <g
        id="cloudFill"
        style={{
          fill: "white",
          fillOpacity: 1,
          stroke: "none",
        }}
        mask="url(#progressMask)"
        transform="matrix(0.05216598,0,0,0.05216598,22.496719,83.137216)"
      >
        <path d="m 640,352 c 0,70.692 -57.308,128 -128,128 H 144 C 64.471,480 0,415.529 0,336 0,273.227 40.171,219.845 96.204,200.133 A 163.68,163.68 0 0 1 96,192 C 96,103.634 167.634,32 256,32 315.288,32 367.042,64.248 394.684,112.159 409.935,101.954 428.271,96 448,96 c 53.019,0 96,42.981 96,96 0,12.184 -2.275,23.836 -6.415,34.56 C 596.017,238.414 640,290.07 640,352 Z M 404.686,260.686 299.314,155.314 c -6.248,-6.248 -16.379,-6.248 -22.627,0 L 171.314,260.686 C 161.234,270.766 168.373,288 182.627,288 H 248 v 112 c 0,8.837 7.164,16 16,16 h 48 c 8.836,0 16,-7.163 16,-16 V 288 h 65.373 c 14.254,0 21.393,-17.234 11.313,-27.314 z" />
      </g>
      <g
        id="use1-9"
        style={{
          fill: "#ffff00",
          stroke: "none",
        }}
        transform="matrix(0.00658794,0,0,0.00658794,46.254302,105.75252)"
      >
        <title id="title1">{"lock"}</title>
        <path
          d="M 400,224 H 376 V 152 C 376,68.2 307.8,0 224,0 140.2,0 72,68.2 72,152 v 72 H 48 C 21.5,224 0,245.5 0,272 v 192 c 0,26.5 21.5,48 48,48 h 352 c 26.5,0 48,-21.5 48,-48 V 272 c 0,-26.5 -21.5,-48 -48,-48 z m -104,0 H 152 v -72 c 0,-39.7 32.3,-72 72,-72 39.7,0 72,32.3 72,72 z"
          id="path1"
        />
      </g>
      <text
        xmlSpace="preserve"
        style={{
          fontSize: "2.64583px",
          lineHeight: 1.25,
          fontFamily: "sans-serif",
          textAlign: "center",
          textAnchor: "middle",
          fill: "#ffffff",
          strokeWidth: 0.264583,
        }}
        x={53.766098}
        y={108.397}
        id="text13"
      >
        <tspan
          id="tspan13"
          x={53.766098}
          y={108.397}
          style={{
            fontStyle: "normal",
            fontVariant: "normal",
            fontWeight: "normal",
            fontStretch: "normal",
            fontSize: "2.64583px",
            fontFamily: "'Liberation Mono'",
            strokeWidth: 0.264583,
          }}
        >
          {"E2E"}
        </tspan>
      </text>
    </g>
  </svg>
);
