"use client";
/**
 * Her room. The score IS the picture: high pain = dark, rainy, cold.
 * Zero = dawn, warm, lamp on. Everything he sends collects around her and stays.
 */
/* 18 hand-checked slots around her. Rows sit 12% apart (an emoji is ~11% tall) and
   neighbours in a row >=8% apart (~6% wide), so nothing can collide. Her body
   occupies x 44-70 / y 46-80, so those stay empty. */
const GIFT_SLOTS: [number, number][] = [
  [22,62],[84,62],[22,50],[84,50],[22,74],[84,74],
  [10,62],[92,62],[10,50],[92,50],[10,74],[92,74],
  [26,86],[40,86],[68,86],[26,26],[54,26],[82,26],
];

export default function RoomScene({
  score, gifts, angry = false, fill = false,
}: {
  score: number;
  gifts: { emoji: string; name: string }[];
  angry?: boolean;
  /** Let the room grow on a tall phone. It keeps its shape — cropping it
   *  loses the window and the lamp, which are how you read her mood. */
  fill?: boolean;
}) {
  const band = score > 65 ? 0 : score > 40 ? 1 : score > 20 ? 2 : 3;
  const t = 1 - score / 100;

  const SKY  = [["#5E4E80","#8C6E9B"],["#7C5F92","#C084A4"],["#E08CA8","#FFC38E"],["#FFC7DC","#FFEFC2"]][band];
  const WALL = [["#6B5573","#513F5C"],["#856089","#66496F"],["#B27FA0","#8A6180"],["#E4A9C4","#BC85A4"]][band];
  const FLOOR= ["#42304C","#543A57","#70506A","#966E85"][band];
  const hurt = score > 35;

  return (
    <div className={`relative rounded-blob overflow-hidden border-2 border-line
                     ${fill ? "w-full" : ""}`}>
      <svg viewBox="0 0 520 300" role="img"
           className="block w-full h-auto"
           aria-label="Her room — it warms up as her pain goes down">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY[0]} /><stop offset="100%" stopColor={SKY[1]} />
          </linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WALL[0]} /><stop offset="100%" stopColor={WALL[1]} />
          </linearGradient>
          <radialGradient id="lamp">
            <stop offset="0%" stopColor="#FFD59B" stopOpacity={0.22 + t * 0.55} />
            <stop offset="100%" stopColor="#FFD59B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ache">
            <stop offset="0%" stopColor="#FF5C8A" stopOpacity=".95" />
            <stop offset="100%" stopColor="#FF5C8A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="520" height="300" fill="url(#wall)" />
        <rect y="234" width="520" height="66" fill={FLOOR} />

        {/* window */}
        <rect x="36" y="34" width="176" height="132" rx="14" fill="url(#sky)" />
        <g opacity={Math.max(0, (score - 25) / 75)} stroke="#CFE2F5" strokeWidth="1.7" strokeLinecap="round">
          {Array.from({ length: 22 }, (_, i) => {
            const x = 44 + ((i * 37) % 158), y = 40 + ((i * 53) % 112);
            return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 13} />;
          })}
        </g>
        <circle cx="176" cy="66" r="15" fill={band >= 2 ? "#FFF6C9" : "#FFF2D6"} opacity={0.3 + t * 0.7} />
        <rect x="36" y="34" width="176" height="132" rx="14" fill="none" stroke="#E7BBD3" strokeWidth="6" />
        <line x1="124" y1="34" x2="124" y2="166" stroke="#E7BBD3" strokeWidth="4.5" />
        <line x1="36" y1="100" x2="212" y2="100" stroke="#E7BBD3" strokeWidth="4.5" />

        {/* fairy lights */}
        <path d="M28 26 Q130 62 232 26" fill="none" stroke="#F6C9DE" strokeWidth="2" opacity=".75" />
        <circle cx="70" cy="42" r="4" fill="#FFE08A" /><circle cx="110" cy="52" r="4" fill="#FFB3D0" />
        <circle cx="150" cy="52" r="4" fill="#B9E8D5" /><circle cx="190" cy="42" r="4" fill="#D9B8F5" />

        {/* lamp */}
        <circle cx="438" cy="118" r="86" fill="url(#lamp)" />
        <rect x="434" y="128" width="8" height="88" rx="4" fill="#E7BBD3" />
        <path d="M408 128 L468 128 L455 98 L421 98 Z" fill="#FFD08A" />

        {/* plant */}
        <rect x="50" y="200" width="32" height="34" rx="9" fill="#F2A98C" />
        <path d="M66 200 C56 180 42 176 42 176 C58 174 66 185 66 196 C70 179 86 170 86 170 C84 187 74 198 66 200Z" fill="#8ED3AE" />

        {/* bed */}
        <rect x="194" y="176" width="204" height="62" rx="22" fill="#8E6B97" />
        <rect x="194" y="154" width="204" height="36" rx="18" fill="#A27FAB" />

        {/* her */}
        <path d="M246 234 Q252 186 294 186 Q338 188 342 234 Z" fill="#F7A8C6" />
        <ellipse cx="294" cy="212" rx={26 + score * 0.26} ry="30" fill="url(#ache)" opacity={Math.max(0, score / 100 * 0.9)} />
        <circle cx="294" cy="163" r="25" fill="#FFDCC2" />
        <path d="M269 160 Q270 133 294 133 Q318 133 319 160 Q312 145 294 145 Q276 145 269 160Z" fill="#4A2C40" />
        <path d="M268 158 Q261 184 268 198 Q272 179 272 162Z" fill="#4A2C40" />
        <path d="M320 158 Q327 184 320 198 Q316 179 316 162Z" fill="#4A2C40" />
        <path d="M310 138 q9 -6 13 3 q-8 -1 -13 -3Z" fill="#FF9EC4" />
        {angry ? (
          <>
            <g stroke="#4A2C40" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M282 157 l10 5" /><path d="M306 157 l-10 5" />
              <path d="M283 166 l9 0" /><path d="M297 166 l9 0" />
            </g>
            <path d="M286 178 q8 -7 16 0 q-8 3 -16 0" fill="#B0234A" />
            <g stroke="#E5326E" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M258 136 l7 -7 M265 136 l-7 -7 M262 128 l0 12 M256 134 l12 0" />
            </g>
          </>
        ) : hurt ? (
          <g stroke="#4A2C40" strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M284 162 q4 -4 8 0" /><path d="M298 162 q4 -4 8 0" /><path d="M288 176 q6 -5 12 0" />
          </g>
        ) : (
          <>
            <g stroke="#4A2C40" strokeWidth="2.6" fill="none" strokeLinecap="round">
              <path d="M284 161 q4 4 8 0" /><path d="M298 161 q4 4 8 0" /><path d="M288 174 q6 6 12 0" />
            </g>
            <circle cx="276" cy="171" r="5.5" fill="#FF9EC4" opacity=".6" />
            <circle cx="312" cy="171" r="5.5" fill="#FF9EC4" opacity=".6" />
          </>
        )}
      </svg>

      {/* everything he has sent, collecting around her */}
      {gifts.slice(0, GIFT_SLOTS.length).map((g, n) => (
        <div key={n} title={g.name}
             className="absolute text-[24px] leading-none pop drop-shadow-[0_2px_5px_rgba(60,20,50,.55)]"
             style={{ left: `${GIFT_SLOTS[n][0]}%`, top: `${GIFT_SLOTS[n][1]}%` }}>
          {g.emoji}
        </div>
      ))}
      {gifts.length > GIFT_SLOTS.length && (
        <div title={`${gifts.length - GIFT_SLOTS.length} more things he sent`}
             className="absolute right-2 bottom-2 font-round font-black text-xs
                        text-[#FFF0F7] bg-[rgba(90,36,64,.72)] rounded-full px-2 py-[3px]">
          +{gifts.length - GIFT_SLOTS.length}
        </div>
      )}
    </div>
  );
}
