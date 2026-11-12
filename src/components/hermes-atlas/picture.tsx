import { atlasTheme } from "./theme";

export function Picture({ kind, name }: { kind: string; name: string }) {
  const ink = atlasTheme.text.primary;
  const gold = atlasTheme.accent;
  return (
    <svg
      width="100%"
      height="150"
      viewBox="0 0 300 150"
      role="img"
      aria-label={`Original symbolic illustration for ${name}; not an ancient portrait`}
      className="hermes-atlas-picture max-w-full"
    >
      <circle cx="150" cy="75" r="63" fill="none" stroke={atlasTheme.border.default} />
      <circle cx="150" cy="75" r="53" fill="none" stroke={atlasTheme.border.subtle} />
      <path d="M40 75H82M218 75H260M150 5V16M150 134V145" stroke={gold} fill="none" />
      {kind === "staff" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M150 126V31M150 49C116 32 109 50 135 64C177 85 174 99 145 114M150 49C184 32 191 50 165 64C123 85 126 99 155 114" />
          <circle cx="150" cy="25" r="5" />
          <path d="M145 43Q111 43 105 25Q132 24 145 43M155 43Q189 43 195 25Q168 24 155 43" />
        </g>
      ) : kind === "ibis" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M129 124V74Q115 62 131 45Q143 32 155 44Q165 48 159 57Q187 55 194 83Q180 66 156 63L161 125M131 75L115 109M155 125H176M129 124H111" />
          <circle cx="150" cy="49" r="2" fill={ink} />
          <circle cx="140" cy="27" r="10" stroke={gold} />
          <path d="M128 26Q139 41 151 26" />
        </g>
      ) : kind === "scales" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M150 24V123M119 124H181M108 51H192M115 51L98 88H132L115 51M185 51L168 88H202L185 51M98 88Q115 112 132 88M168 88Q185 112 202 88" />
          <path d="M148 37Q122 22 140 17Q156 15 148 37" stroke={gold} />
        </g>
      ) : kind === "planet" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <circle cx="150" cy="70" r="27" />
          <path d="M150 97V125M133 112H167M126 26Q150 62 174 26" />
          <ellipse cx="150" cy="70" rx="65" ry="18" transform="rotate(-23 150 70)" stroke={gold} />
        </g>
      ) : kind === "snake" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M150 25V126M163 40C126 30 124 54 153 65C181 77 177 96 143 101" />
          <circle cx="165" cy="40" r="3" fill={gold} />
        </g>
      ) : kind === "pillar" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <circle cx="150" cy="38" r="18" />
          <path d="M128 62H172V126H128ZM118 127H182M129 81H171M141 32V37M159 32V37M143 46H157" />
        </g>
      ) : kind === "lyre" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M115 30Q95 119 150 120Q205 119 185 30M115 42H185M122 80H178M132 44V108M144 44V115M156 44V115M168 44V108" />
          <path d="M112 28H126M174 28H188" stroke={gold} />
        </g>
      ) : kind === "roads" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M103 119L151 72L197 120M150 73V22M150 73L106 32M150 73L199 30" />
          <circle cx="150" cy="73" r="12" stroke={gold} />
          <path d="M88 121H112M186 121H212M137 21H163" />
        </g>
      ) : kind === "stars" ? (
        <g fill="none" stroke={ink} strokeWidth="2">
          <path d="M105 107L128 64L176 45L198 91L154 116L128 64L150 23L176 45" />
          {[[105, 107], [128, 64], [176, 45], [198, 91], [154, 116], [150, 23]].map((point, i) => (
            <circle
              key={i}
              cx={point[0]}
              cy={point[1]}
              r={i === 1 ? 6 : 4}
              fill={gold}
              stroke="none"
            />
          ))}
        </g>
      ) : kind === "tablet" ? (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M120 21H180Q190 21 190 31V121H110V31Q110 21 120 21ZM125 44H175M125 60H175M125 76H175M125 92H175M137 106H164" />
          <path d="M118 30L126 22M182 114L190 106" stroke={gold} />
        </g>
      ) : (
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M150 39Q124 23 103 38V115Q126 103 150 120Q174 103 197 115V38Q176 23 150 39V120M114 50L139 53M114 66L139 69M114 82L139 85M161 53L186 50M161 69L186 66M161 85L186 82" />
        </g>
      )}
    </svg>
  );
}
