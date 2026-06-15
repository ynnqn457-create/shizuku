import { useState, useEffect, useCallback } from "react";

/* ===================================================================
   しずく (shizuku) — 統合パーソナルアプリ / スマホ最適化版
   モジュール: 吐き出す / 作り置きノート / 買い出しリスト / 夜のメモ /
              ショッピング / ネット購入 / 仕事 / 旅行
   =================================================================== */

/* ---------- デザイントークン ---------- */
const C = {
  bg: "#F3F6F5",
  card: "#FFFFFF",
  ink: "#22383C",
  sub: "#6B8388",
  line: "#E2EAE9",
  accent: "#3D7C7A",
  accentSoft: "#E4F0EE",
  night: "#2C3A52",
  warn: "#C0633E",
};

const MODULES = [
  { id: "dump", emoji: "🌱", name: "吐き出す", desc: "頭の中をぜんぶ出す" },
  { id: "meal", emoji: "🍱", name: "作り置きノート", desc: "週末の献立づくり" },
  { id: "grocery", emoji: "🛒", name: "買い出しリスト", desc: "スーパーで見る用" },
  { id: "night", emoji: "🌙", name: "夜のメモ", desc: "今日を手放す" },
  { id: "shopping", emoji: "🛍", name: "ショッピング", desc: "お店と欲しいもの" },
  { id: "online", emoji: "📦", name: "ネット購入", desc: "サイト別の買うもの" },
  { id: "work", emoji: "💊", name: "仕事", desc: "メモとタスク" },
  { id: "travel", emoji: "✈️", name: "旅行", desc: "行きたい場所と計画" },
];

/* ---------- 保存(セッションをまたいで残る) ---------- */
const KEY = "shizuku:data:v1";

const EMPTY = {
  dump: { items: [] },          // {id, text, module?, suggestion?}
  meal: { menus: [], saved: [], myRecipes: [] },
  grocery: { items: [] },       // {id, name, done}
  night: { entries: [] },       // {id, date, text, emotions, comment, release}
  shopping: { items: [] },      // {id, name, store, done}
  online: { items: [] },        // {id, name, site, done}
  work: { memos: [], tasks: [] },
  travel: { items: [] },        // {id, place, area, status, note}
};

async function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      const merged = { ...EMPTY };
      Object.keys(EMPTY).forEach((k) => { merged[k] = { ...EMPTY[k], ...(v[k] || {}) }; });
      return merged;
    }
  } catch (e) { /* 初回はキーが無いだけなのでOK */ }
  return { ...EMPTY };
}

async function saveAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { console.error("保存に失敗:", e); }
}

/* ---------- 内蔵レシピ帳(弁当向け・水分が出にくい作り置き) ----------
   season: "夏"(6〜9月向き) / "冬"(11〜3月向き) / なし=通年 */
const RECIPES = {
  main: [
    { name: "鶏むねの照り焼き", point: "片栗粉をまぶして焼くとタレが絡んで水分が出にくい", ing: ["鶏むね肉", "片栗粉", "醤油", "みりん"],
      recipe: { amounts: ["鶏むね肉 1枚(300g)", "片栗粉 大さじ1", "醤油 大さじ1.5", "みりん 大さじ1.5", "砂糖 小さじ1"],
        steps: ["鶏むね肉は厚みを均一にしてひと口大に切り、片栗粉をまぶす", "フライパンに油を熱し、皮目から中火で焼く", "両面に焼き色がついたら、醤油・みりん・砂糖を加えて煮絡める", "汁気がなくなるまで煮詰めて完成"] } },
    { name: "豚こまの生姜焼き", point: "汁気を飛ばし切ってから保存容器へ", ing: ["豚こま肉", "玉ねぎ", "生姜", "醤油"],
      recipe: { amounts: ["豚こま肉 250g", "玉ねぎ 半分", "生姜 1かけ(すりおろし)", "醤油 大さじ2", "みりん 大さじ2", "砂糖 小さじ1"],
        steps: ["玉ねぎは薄切りにする", "フライパンに油を熱し、玉ねぎをしんなりするまで炒める", "豚こま肉を加えて色が変わるまで炒める", "醤油・みりん・砂糖・生姜を加え、汁気がなくなるまで炒め合わせる"] } },
    { name: "鶏そぼろ", point: "弁当の彩り役。汁気がなくなるまで炒りつける", ing: ["鶏ひき肉", "生姜", "醤油", "砂糖"],
      recipe: { amounts: ["鶏ひき肉 200g", "生姜 1かけ(すりおろし)", "醤油 大さじ1.5", "砂糖 大さじ1", "みりん 大さじ1"],
        steps: ["鍋に鶏ひき肉と調味料、生姜をすべて入れる", "中火にかけ、箸4〜5本でかき混ぜながら火を通す", "そぼろ状にほぐれたら、汁気がなくなるまで炒り続けて完成"] } },
    { name: "ミニハンバーグ", point: "小さめに焼くと弁当に入れやすく冷凍もOK", ing: ["合いびき肉", "玉ねぎ", "パン粉", "卵"],
      recipe: { amounts: ["合いびき肉 250g", "玉ねぎ 半分(みじん切り)", "パン粉 大さじ3", "卵 1個", "塩こしょう 少々", "ケチャップ・中濃ソース 各大さじ1"],
        steps: ["玉ねぎをみじん切りにし、軽く炒めて冷ます", "ボウルにひき肉・玉ねぎ・パン粉・卵・塩こしょうを入れ、粘りが出るまで混ぜる", "小さめの小判形に丸める", "フライパンで両面じっくり焼き、中まで火を通す", "ケチャップと中濃ソースを混ぜてかける"] } },
    { name: "鶏むねの塩麹焼き", point: "塩麹でしっとり。冷めても固くなりにくい", ing: ["鶏むね肉", "塩麹"],
      recipe: { amounts: ["鶏むね肉 1枚(300g)", "塩麹 大さじ1.5"],
        steps: ["鶏むね肉はフォークで数カ所穴を開け、ひと口大に切る", "塩麹をまぶし、できれば30分〜一晩置く", "フライパンに油を熱し、中火で両面じっくり焼く", "中まで火が通ったら完成"] } },
    { name: "豚肉とピーマンの甘辛炒め", point: "強火で手早く炒めて水分を出さない", ing: ["豚こま肉", "ピーマン", "醤油", "オイスターソース"],
      recipe: { amounts: ["豚こま肉 200g", "ピーマン 3個", "醤油 大さじ1", "オイスターソース 大さじ1", "砂糖 小さじ1"],
        steps: ["ピーマンは細切りにする", "フライパンを強火で熱し、豚こま肉を炒める", "色が変わったらピーマンを加えてさっと炒める", "調味料を加え、手早く炒め合わせて完成"] } },
    { name: "鶏の唐揚げ(揚げ焼き)", point: "二度焼きで冷めてもカリッと。弁当の主役", ing: ["鶏もも肉", "にんにく", "片栗粉", "醤油"],
      recipe: { amounts: ["鶏もも肉 1枚(250g)", "醤油・酒 各大さじ1", "にんにく・生姜 各1かけ(すりおろし)", "片栗粉 大さじ3"],
        steps: ["鶏もも肉をひと口大に切り、醤油・酒・にんにく・生姜に15分漬ける", "汁気を軽く拭き、片栗粉をまぶす", "フライパンに油を1cmほど熱し、中火で揚げ焼きにする", "一度取り出し、油の温度を上げて二度目をさっと揚げてカリッとさせる"] } },
    { name: "肉団子の甘酢あん", point: "あんは少なめに絡める程度なら水分が出にくい", ing: ["豚ひき肉", "玉ねぎ", "片栗粉", "酢", "ケチャップ"],
      recipe: { amounts: ["豚ひき肉 200g", "玉ねぎ 1/4(みじん切り)", "片栗粉 大さじ1(肉だね用)", "酢・ケチャップ・砂糖・醤油 各大さじ1(あん用)", "片栗粉 小さじ1+水大さじ1(とろみ用)"],
        steps: ["ひき肉・玉ねぎ・片栗粉を混ぜて団子状に丸める", "フライパンで揚げ焼きにし、火を通す", "別に甘酢の調味料を煮立て、水溶き片栗粉でとろみをつける", "団子にあんを軽く絡めて完成"] } },
    { name: "鶏むねのカレー焼き", point: "カレー粉の抗菌効果で夏の弁当に心強い", ing: ["鶏むね肉", "カレー粉", "ヨーグルト"], season: "夏",
      recipe: { amounts: ["鶏むね肉 1枚(300g)", "カレー粉 大さじ1", "ヨーグルト(無糖) 大さじ2", "塩 小さじ1/2"],
        steps: ["鶏むね肉をひと口大に切る", "カレー粉・ヨーグルト・塩を混ぜたものに30分以上漬ける", "フライパンに油を熱し、中火で両面じっくり焼いて完成"] } },
    { name: "豚しゃぶの梅だれ和え", point: "梅でさっぱり&日持ち。たれは和えすぎない", ing: ["豚ロース薄切り", "梅干し", "大葉"], season: "夏",
      recipe: { amounts: ["豚ロース薄切り 200g", "梅干し 2個(種を除いてつぶす)", "大葉 4枚(細切り)", "醤油・みりん 各小さじ1"],
        steps: ["鍋にお湯を沸かし、豚肉を1枚ずつくぐらせて茹でる", "冷水に取って粗熱を取り、水気をしっかり拭く", "梅干し・醤油・みりんを混ぜたたれで和える", "大葉を加えて軽く混ぜて完成"] } },
    { name: "ガパオ風そぼろ", point: "汁気ゼロでご飯に合う。バジルは仕上げに", ing: ["鶏ひき肉", "ピーマン", "バジル", "オイスターソース"], season: "夏",
      recipe: { amounts: ["鶏ひき肉 200g", "ピーマン 2個(粗みじん)", "にんにく 1かけ", "オイスターソース・醤油 各大さじ1", "砂糖 小さじ1", "バジル 適量"],
        steps: ["フライパンにみじん切りのにんにくを入れ、香りが出るまで炒める", "鶏ひき肉を加えて炒め、ほぐす", "ピーマンを加えてさっと炒める", "調味料を加え、汁気がなくなるまで炒める", "火を止めてからバジルを混ぜる"] } },
    { name: "タンドリーチキン", point: "漬けて焼くだけ。スパイスで傷みにくい", ing: ["鶏もも肉", "ヨーグルト", "カレー粉", "ケチャップ"], season: "夏",
      recipe: { amounts: ["鶏もも肉 1枚(250g)", "ヨーグルト(無糖) 大さじ3", "カレー粉 大さじ1", "ケチャップ 大さじ1", "にんにく・生姜 各1かけ(すりおろし)", "塩 小さじ1/2"],
        steps: ["鶏もも肉をひと口大に切る", "調味料をすべて混ぜたものに30分〜一晩漬ける", "フライパンかオーブンで中まで火を通すようにじっくり焼いて完成"] } },
    { name: "豚バラ大根", point: "煮汁を含ませてから煮切る。冬の定番", ing: ["豚バラ肉", "大根", "生姜", "醤油"], season: "冬",
      recipe: { amounts: ["豚バラ肉 150g", "大根 1/3本", "生姜 1かけ(薄切り)", "醤油・みりん・酒 各大さじ1.5", "砂糖 大さじ1", "水 100ml"],
        steps: ["大根は1.5cm幅の半月切りにする", "鍋で豚バラ肉を炒め、脂が出たら大根と生姜を加えて炒める", "水と調味料を加え、落とし蓋をして大根が柔らかくなるまで煮る", "蓋を取り、汁気が少なくなるまで煮詰める"] } },
    { name: "鶏じゃが(汁なし)", point: "粉ふきいも状に水分を飛ばせば弁当もOK", ing: ["鶏もも肉", "じゃがいも", "玉ねぎ", "醤油"], season: "冬",
      recipe: { amounts: ["鶏もも肉 150g", "じゃがいも 2個", "玉ねぎ 1/2個", "醤油・みりん 各大さじ1.5", "砂糖 大さじ1", "水 100ml"],
        steps: ["じゃがいもはひと口大、玉ねぎはくし切りにする", "鍋で鶏肉を炒め、玉ねぎ・じゃがいもを加えて炒める", "水と調味料を加え、蓋をして煮る", "じゃがいもが柔らかくなったら蓋を取り、汁気を飛ばしながら煮詰める"] } },
    { name: "豚肉の味噌漬け焼き", point: "漬け込みで日持ち。焼くだけストックに", ing: ["豚ロース", "味噌", "みりん"], season: "冬",
      recipe: { amounts: ["豚ロース肉 2枚(200g)", "味噌 大さじ2", "みりん 大さじ1", "砂糖 小さじ1"],
        steps: ["味噌・みりん・砂糖を混ぜて豚肉に塗る", "ラップで包み、半日〜一晩漬ける", "味噌を軽く拭き取り、焦げやすいので弱めの中火で両面焼く"] } },
    { name: "鶏手羽の甘辛焼き", point: "タレを煮詰めて照りを出す。骨なしなら弁当も", ing: ["鶏手羽中", "醤油", "みりん", "ごま"], season: "冬",
      recipe: { amounts: ["鶏手羽中 8本", "醤油・みりん・酒 各大さじ1.5", "砂糖 大さじ1", "白ごま 適量"],
        steps: ["フライパンに油を熱し、手羽中の両面をこんがり焼く", "余分な油を拭き、調味料を加える", "中火で煮絡め、照りが出るまで煮詰める", "仕上げに白ごまを振る"] } },
  ],
  fish: [
    { name: "鮭の塩焼き", point: "焼いてから骨を外しておくと弁当詰めがラク", ing: ["生鮭 2切", "塩"],
      recipe: { amounts: ["生鮭 2切れ", "塩 適量"],
        steps: ["鮭の両面に塩を振り、10分ほど置いて水気を拭く", "フライパンかグリルで皮目から中火で焼く", "中まで火が通ったら、骨を取り除いておく"] } },
    { name: "ぶりの照り焼き", point: "タレは煮詰めて絡める。汁気を残さない", ing: ["ぶり 2切", "醤油", "みりん", "砂糖"], season: "冬",
      recipe: { amounts: ["ぶり 2切れ", "醤油・みりん・酒 各大さじ1.5", "砂糖 大さじ1"],
        steps: ["ぶりは水気を拭き、薄く片栗粉をまぶしても良い", "フライパンに油を熱し、両面を焼き色がつくまで焼く", "調味料を加えて中火で煮絡め、とろみがつくまで煮詰める"] } },
    { name: "さばの味噌煮", point: "保存時に煮汁を切れば弁当にも入れやすい", ing: ["さば 2切", "味噌", "生姜", "みりん"], season: "冬",
      recipe: { amounts: ["さば 2切れ", "味噌 大さじ1.5", "みりん・酒 各大さじ1.5", "砂糖 大さじ1", "生姜 1かけ(薄切り)", "水 100ml"],
        steps: ["さばは皮目に切り込みを入れる", "鍋に水・生姜・酒を入れて煮立て、さばを入れる", "味噌・みりん・砂糖を加え、落とし蓋をして中火で煮る", "煮汁が少なくなったら、煮汁をかけながら仕上げる"] } },
    { name: "鮭の味噌マヨ焼き", point: "味噌マヨでパサつき防止。冷めてもおいしい", ing: ["生鮭 2切", "味噌", "マヨネーズ"],
      recipe: { amounts: ["生鮭 2切れ", "味噌・マヨネーズ 各大さじ1", "みりん 小さじ1"],
        steps: ["味噌・マヨネーズ・みりんを混ぜ合わせる", "鮭の両面に塗り、グリルかオーブンで焼く", "焦げやすいので途中で様子を見ながら火を通す"] } },
    { name: "めかじきのバター醤油", point: "水気を拭いてから焼くと臭みも水分も出ない", ing: ["めかじき 2切", "バター", "醤油"],
      recipe: { amounts: ["めかじき 2切れ", "バター 10g", "醤油 大さじ1", "塩こしょう 少々"],
        steps: ["めかじきは水気をしっかり拭き、塩こしょうをする", "フライパンにバターを熱し、両面を焼く", "火が通ったら醤油を回しかけ、香りが立ったら完成"] } },
    { name: "さわらの西京焼き", point: "漬けて焼くだけ。焦げやすいので弱めの火で", ing: ["さわら 2切", "西京味噌", "みりん"],
      recipe: { amounts: ["さわら 2切れ", "西京味噌 大さじ2", "みりん 大さじ1"],
        steps: ["西京味噌とみりんを混ぜ、さわらの両面に塗る", "一晩(最低数時間)漬ける", "味噌を軽く拭き取り、焦げやすいので弱火〜中火でじっくり焼く"] } },
    { name: "あじの南蛮漬け", point: "酢で日持ち◎。弁当には汁気を切って", ing: ["あじ 2尾", "玉ねぎ", "酢", "片栗粉"], season: "夏",
      recipe: { amounts: ["あじ(三枚おろし) 2尾分", "玉ねぎ 1/2個(薄切り)", "片栗粉 適量", "酢・醤油・砂糖 各大さじ2", "水 大さじ2"],
        steps: ["あじに片栗粉をまぶし、油で揚げ焼きにする", "玉ねぎは薄切りにする", "酢・醤油・砂糖・水を混ぜ合わせる", "揚げたあじと玉ねぎを漬け汁に浸し、味がなじむまで置く"] } },
    { name: "さばの竜田揚げ", point: "揚げ焼きでOK。冷めても香ばしい", ing: ["さば 2切", "生姜", "片栗粉", "醤油"], season: "夏",
      recipe: { amounts: ["さば 2切れ", "醤油・酒 各大さじ1", "生姜 1かけ(すりおろし)", "片栗粉 適量"],
        steps: ["さばをひと口大に切り、醤油・酒・生姜に15分漬ける", "汁気を拭き、片栗粉をまぶす", "フライパンに油を多めに熱し、揚げ焼きにしてカリッと仕上げる"] } },
    { name: "鮭のレモンマリネ焼き", point: "レモンでさっぱり。焼いてから漬けると崩れない", ing: ["生鮭 2切", "レモン", "オリーブオイル"], season: "夏",
      recipe: { amounts: ["生鮭 2切れ", "レモン 1/4個(薄切り)", "オリーブオイル 大さじ1", "塩こしょう 少々"],
        steps: ["鮭に塩こしょうをし、オリーブオイルでこんがり焼く", "焼き上がったら、レモンの薄切りと一緒に保存容器に入れる", "粗熱が取れたら蓋をして冷蔵庫で味をなじませる"] } },
    { name: "たらのムニエル", point: "粉をしっかりはたいて水分を閉じ込める", ing: ["たら 2切", "小麦粉", "バター"], season: "冬",
      recipe: { amounts: ["たら 2切れ", "小麦粉 適量", "バター 10g", "塩こしょう 少々"],
        steps: ["たらは水気を拭き、塩こしょうをして小麦粉を薄くまぶす", "フライパンにバターを熱し、中火で両面をこんがり焼く"] } },
    { name: "ぶり大根(汁なし)", point: "煮汁を煮切れば弁当にも。冬の主役", ing: ["ぶり 2切", "大根", "生姜", "醤油"], season: "冬",
      recipe: { amounts: ["ぶり 2切れ", "大根 1/3本", "生姜 1かけ(薄切り)", "醤油・みりん・酒 各大さじ1.5", "砂糖 大さじ1", "水 150ml"],
        steps: ["大根は1.5cm幅の輪切りまたは半月切りにする", "ぶりは熱湯をかけて臭みを取る", "鍋に水・生姜・大根を入れて柔らかくなるまで煮る", "ぶりと調味料を加え、汁気が少なくなるまで煮詰める"] } },
    { name: "いわしの蒲焼き", point: "タレを絡めて照りよく。骨まで柔らかく", ing: ["いわし 2尾", "醤油", "みりん", "片栗粉"],
      recipe: { amounts: ["いわし(開いたもの) 2尾分", "片栗粉 適量", "醤油・みりん・酒 各大さじ1.5", "砂糖 大さじ1"],
        steps: ["いわしに片栗粉を薄くまぶす", "フライパンに油を熱し、両面をこんがり焼く", "調味料を加えて煮絡め、照りが出るまで煮詰める"] } },
  ],
  side: [
    { name: "きんぴらごぼう", point: "しっかり炒めて水分を飛ばす。弁当の定番", ing: ["ごぼう", "にんじん", "ごま"],
      recipe: { amounts: ["ごぼう 1本", "にんじん 1/3本", "ごま油 大さじ1", "醤油・みりん 各大さじ1", "砂糖 小さじ1", "白ごま 適量"],
        steps: ["ごぼう・にんじんは細切りにする(ごぼうは水にさらす)", "ごま油で炒め、しんなりしたら調味料を加える", "汁気がなくなるまで炒め、白ごまを振る"] } },
    { name: "にんじんしりしり", point: "卵でとじると水分が出にくく彩りも◎", ing: ["にんじん", "卵", "ツナ缶"],
      recipe: { amounts: ["にんじん 1本", "卵 1個", "ツナ缶 1/2缶", "醤油 大さじ1/2", "ごま油 大さじ1/2"],
        steps: ["にんじんは細切りにする", "ごま油で炒め、しんなりしたらツナを加える", "醤油で味付けし、溶き卵を回し入れて炒り卵状にする"] } },
    { name: "ほうれん草の胡麻和え", point: "茹でたらしっかり絞る。和えるのは食べる直前でも", ing: ["ほうれん草", "すりごま", "醤油"], season: "冬",
      recipe: { amounts: ["ほうれん草 1束", "すりごま 大さじ2", "醤油 大さじ1", "砂糖 小さじ1"],
        steps: ["ほうれん草を茹でて冷水にさらし、しっかり水気を絞る", "食べやすい長さに切る", "すりごま・醤油・砂糖と和える"] } },
    { name: "ひじきの煮物", point: "汁気がなくなるまで煮含めると日持ちする", ing: ["乾燥ひじき", "にんじん", "油揚げ"],
      recipe: { amounts: ["乾燥ひじき 10g", "にんじん 1/3本", "油揚げ 1枚", "醤油・みりん 各大さじ1.5", "砂糖 大さじ1", "水 100ml"],
        steps: ["ひじきは水で戻し、にんじん・油揚げは細切りにする", "鍋にごま油を熱し、すべての具材を炒める", "水と調味料を加え、汁気がなくなるまで煮る"] } },
    { name: "厚焼き卵", point: "砂糖多めだと冷めてもしっとり", ing: ["卵", "砂糖", "白だし"],
      recipe: { amounts: ["卵 3個", "砂糖 大さじ1", "白だし 小さじ1", "水 大さじ1"],
        steps: ["卵を溶き、砂糖・白だし・水を加えて混ぜる", "卵焼き器に油を熱し、数回に分けて巻きながら焼く", "厚みが出たら取り出し、形を整えて切る"] } },
    { name: "かぼちゃの甘煮", point: "煮汁を吸わせ切ってホクホクに", ing: ["かぼちゃ", "砂糖", "醤油"], season: "冬",
      recipe: { amounts: ["かぼちゃ 1/4個", "砂糖 大さじ1.5", "醤油 大さじ1/2", "水 100ml"],
        steps: ["かぼちゃはひと口大に切る", "鍋に皮目を下にして並べ、水と調味料を加える", "落とし蓋をして柔らかくなるまで煮て、汁気を吸わせる"] } },
    { name: "ピーマンとじゃこ炒め", point: "じゃこの塩気で味が決まる。水分ほぼゼロ", ing: ["ピーマン", "ちりめんじゃこ", "ごま油"], season: "夏",
      recipe: { amounts: ["ピーマン 3個", "ちりめんじゃこ 大さじ3", "ごま油 大さじ1", "醤油 少々"],
        steps: ["ピーマンは細切りにする", "ごま油でじゃこをカリッと炒める", "ピーマンを加えてさっと炒め、醤油で味を調える"] } },
    { name: "れんこんの甘辛炒め", point: "シャキシャキ食感が残って弁当向き", ing: ["れんこん", "醤油", "みりん", "ごま"], season: "冬",
      recipe: { amounts: ["れんこん 150g", "醤油・みりん 各大さじ1", "砂糖 小さじ1", "白ごま 適量"],
        steps: ["れんこんは薄切りにして水にさらす", "油で炒め、透き通ってきたら調味料を加える", "汁気を飛ばしながら炒め、ごまを振る"] } },
    { name: "切干大根の煮物", point: "汁気を含ませてから煮切る。冷凍も可", ing: ["切干大根", "にんじん", "油揚げ"],
      recipe: { amounts: ["切干大根 20g", "にんじん 1/3本", "油揚げ 1枚", "醤油・みりん 各大さじ1.5", "砂糖 大さじ1", "水 150ml"],
        steps: ["切干大根は水で戻し、食べやすく切る", "にんじん・油揚げも細切りにする", "鍋で炒め、水と調味料を加えて汁気がなくなるまで煮る"] } },
    { name: "ブロッコリーのおかか和え", point: "固めに茹でて水気をよく切るのがコツ", ing: ["ブロッコリー", "かつお節", "醤油"], season: "冬",
      recipe: { amounts: ["ブロッコリー 1/2株", "かつお節 1パック", "醤油 大さじ1/2"],
        steps: ["ブロッコリーを小房に分け、固めに茹でる", "ザルにあげてしっかり水気を切る", "かつお節と醤油で和える"] } },
    { name: "パプリカのマリネ", point: "酢でさっぱり、日持ち良し。彩り担当", ing: ["パプリカ", "酢", "オリーブオイル"], season: "夏",
      recipe: { amounts: ["パプリカ 1個", "酢 大さじ1.5", "オリーブオイル 大さじ1", "塩・砂糖 各少々"],
        steps: ["パプリカは細切りにし、さっと茹でるか焼いて柔らかくする", "酢・オリーブオイル・塩・砂糖を混ぜたマリネ液に漬ける"] } },
    { name: "こんにゃくのピリ辛炒め", point: "乾煎りしてから味付けすると水分が出ない", ing: ["こんにゃく", "唐辛子", "醤油"],
      recipe: { amounts: ["こんにゃく 1枚", "醤油・みりん 各大さじ1", "輪切り唐辛子 少々", "ごま油 大さじ1/2"],
        steps: ["こんにゃくは短冊切りにし、下茹でして臭みを取る", "油なしでフライパンに入れ、水分を飛ばすように乾煎りする", "ごま油・調味料・唐辛子を加えて炒め合わせる"] } },
    { name: "さつまいものレモン煮", point: "甘酸っぱい箸休め。煮汁は切って保存", ing: ["さつまいも", "レモン", "砂糖"],
      recipe: { amounts: ["さつまいも 1/2本", "レモン(輪切り) 2枚", "砂糖 大さじ2", "水 150ml"],
        steps: ["さつまいもは1cm幅の輪切りにし、水にさらす", "鍋に水・砂糖・レモンと一緒に入れて煮る", "柔らかくなったら火を止め、味を含ませる"] } },
    { name: "小松菜と油揚げの煮浸し", point: "保存前に軽く汁気を切れば弁当もOK", ing: ["小松菜", "油揚げ", "白だし"], season: "冬",
      recipe: { amounts: ["小松菜 1束", "油揚げ 1枚", "白だし 大さじ1.5", "水 100ml"],
        steps: ["小松菜は4cm幅に切り、油揚げは細切りにする", "鍋に水と白だしを煮立て、油揚げを加える", "小松菜を加えてさっと煮て、軽く汁気を切る"] } },
    { name: "ゴーヤの佃煮", point: "甘辛く煮切って苦味もまろやか。夏の常備菜", ing: ["ゴーヤ", "醤油", "砂糖", "かつお節"], season: "夏",
      recipe: { amounts: ["ゴーヤ 1本", "醤油・みりん 各大さじ1.5", "砂糖 大さじ1", "かつお節 1パック"],
        steps: ["ゴーヤは種とワタを取り、薄切りにして塩もみし水気を絞る", "鍋で炒め、調味料を加えて汁気がなくなるまで煮る", "火を止めてかつお節を混ぜる"] } },
    { name: "なすの揚げ浸し(汁切り)", point: "油でコーティングすると水分が出にくい", ing: ["なす", "めんつゆ", "生姜"], season: "夏",
      recipe: { amounts: ["なす 2本", "めんつゆ(2倍濃縮) 大さじ2", "水 大さじ2", "生姜 1かけ(すりおろし)"],
        steps: ["なすは食べやすく切り、油で揚げ焼きにする", "めんつゆと水を合わせたつけ汁に熱いうちに浸す", "味がなじんだら汁気を軽く切り、生姜をのせる"] } },
    { name: "オクラの胡麻和え", point: "さっと茹でて水気を拭く。ねばりで満足感", ing: ["オクラ", "すりごま", "醤油"], season: "夏",
      recipe: { amounts: ["オクラ 8本", "すりごま 大さじ1", "醤油 大さじ1/2"],
        steps: ["オクラは塩で板ずりしてさっと茹でる", "水気をよく拭き、ヘタを取って斜め切りにする", "すりごまと醤油で和える"] } },
    { name: "ズッキーニのカレー炒め", point: "強火で短時間。カレー粉で夏弁当向き", ing: ["ズッキーニ", "カレー粉", "オリーブオイル"], season: "夏",
      recipe: { amounts: ["ズッキーニ 1本", "カレー粉 小さじ1", "オリーブオイル 大さじ1", "塩 少々"],
        steps: ["ズッキーニは1cm幅の輪切りにする", "オリーブオイルを強火で熱し、短時間で焼き色をつける", "カレー粉と塩で味付けする"] } },
    { name: "ミニトマトのマリネ", point: "湯むきすると味しみ◎。汁気は切って詰める", ing: ["ミニトマト", "酢", "はちみつ"], season: "夏",
      recipe: { amounts: ["ミニトマト 10個", "酢 大さじ1", "はちみつ 大さじ1/2", "オリーブオイル 大さじ1/2"],
        steps: ["ミニトマトは湯むきする", "酢・はちみつ・オリーブオイルを混ぜる", "トマトを漬けて冷蔵庫で味をなじませる"] } },
    { name: "いんげんの胡麻味噌和え", point: "濃いめの和え衣で水分をブロック", ing: ["いんげん", "味噌", "すりごま"], season: "夏",
      recipe: { amounts: ["さやいんげん 100g", "味噌 大さじ1", "すりごま 大さじ1", "砂糖 小さじ1"],
        steps: ["いんげんは塩茹でし、水気をよく拭いて斜め切りにする", "味噌・すりごま・砂糖を混ぜる", "いんげんと和える"] } },
    { name: "大学いも", point: "蜜は煮詰めてカリッと。冷めてもおいしい", ing: ["さつまいも", "砂糖", "黒ごま"], season: "冬",
      recipe: { amounts: ["さつまいも 1本", "砂糖・はちみつ 各大さじ1.5", "黒ごま 適量", "油 適量"],
        steps: ["さつまいもは大きめに切り、油でじっくり揚げ焼きにする", "別鍋で砂糖とはちみつを煮詰めて蜜を作る", "揚げたいもに蜜を絡め、黒ごまを振る"] } },
    { name: "白菜とツナの炒め煮", point: "白菜の水分をしっかり飛ばすのがコツ", ing: ["白菜", "ツナ缶", "醤油"], season: "冬",
      recipe: { amounts: ["白菜 1/4株", "ツナ缶 1缶", "醤油 大さじ1"],
        steps: ["白菜はひと口大に切る", "鍋でツナと白菜を炒め、しんなりさせる", "醤油で味付けし、汁気を飛ばすように煮る"] } },
    { name: "里芋の煮っころがし", point: "煮汁を絡め切る。ねっとり冬の味", ing: ["里芋", "醤油", "みりん"], season: "冬",
      recipe: { amounts: ["里芋 6個", "醤油・みりん 各大さじ1.5", "砂糖 大さじ1", "水 150ml"],
        steps: ["里芋は皮をむき、塩でぬめりを取って洗う", "鍋に水と里芋を入れて柔らかくなるまで下茹でする", "調味料を加え、煮汁を絡めながら煮詰める"] } },
    { name: "ほうれん草のナムル", point: "ごま油でコーティングして水分を抑える", ing: ["ほうれん草", "ごま油", "にんにく"], season: "冬",
      recipe: { amounts: ["ほうれん草 1束", "ごま油 大さじ1", "にんにく 1/2かけ(すりおろし)", "塩 少々"],
        steps: ["ほうれん草を茹でて水気をしっかり絞る", "食べやすく切る", "ごま油・にんにく・塩で和える"] } },
    { name: "たたきごぼうの胡麻酢", point: "酢で日持ち。歯ごたえが弁当のアクセント", ing: ["ごぼう", "酢", "すりごま"],
      recipe: { amounts: ["ごぼう 1本", "酢 大さじ1", "すりごま 大さじ1", "砂糖・醤油 各小さじ1"],
        steps: ["ごぼうは麺棒などでたたいて軽くひびを入れ、食べやすく切る", "茹でて水気を切る", "酢・すりごま・砂糖・醤油を混ぜて和える"] } },
    { name: "うずら卵の醤油漬け", point: "漬けるだけ。彩りとたんぱく質を一粒で", ing: ["うずら卵(水煮)", "醤油", "みりん"],
      recipe: { amounts: ["うずら卵(水煮) 10個", "醤油・みりん 各大さじ1", "水 大さじ1"],
        steps: ["醤油・みりん・水をひと煮立ちさせ冷ます", "うずら卵を漬け、半日ほど置く"] } },
    { name: "ちくわの磯辺焼き", point: "青のりの香りで冷めてもおいしい", ing: ["ちくわ", "青のり", "小麦粉"],
      recipe: { amounts: ["ちくわ 4本", "小麦粉 大さじ2", "水 大さじ2", "青のり 小さじ1"],
        steps: ["ちくわは縦半分に切る", "小麦粉・水・青のりを混ぜた衣をつける", "油を熱したフライパンで両面焼く"] } },
    { name: "エリンギのバター醤油", point: "じっくり焼いて水分を飛ばすと旨み凝縮", ing: ["エリンギ", "バター", "醤油"],
      recipe: { amounts: ["エリンギ 2本", "バター 10g", "醤油 大さじ1/2"],
        steps: ["エリンギは食べやすく切る", "バターでじっくり焼き、水分を飛ばすように焼き色をつける", "醤油を回しかけて香りを立たせる"] } },
    { name: "キャベツのカレーソテー", point: "芯まで炒めて甘みを出す。水分注意で強火", ing: ["キャベツ", "カレー粉", "ウインナー"],
      recipe: { amounts: ["キャベツ 1/4個", "ウインナー 3本", "カレー粉 小さじ1", "オリーブオイル 大さじ1"],
        steps: ["キャベツはざく切り、ウインナーは斜め切りにする", "強火でオイルを熱し、ウインナーとキャベツを手早く炒める", "カレー粉で味付けする"] } },
    { name: "スナップエンドウの塩炒め", point: "彩り担当。固めに仕上げて食感キープ", ing: ["スナップエンドウ", "塩", "ごま油"],
      recipe: { amounts: ["スナップエンドウ 10本", "ごま油 大さじ1/2", "塩 少々"],
        steps: ["スナップエンドウは筋を取る", "ごま油で短時間炒め、塩で味付けする"] } },
    { name: "鶏ささみの梅しそ和え", point: "蒸して裂いて和えるだけ。さっぱり系副菜", ing: ["ささみ", "梅干し", "大葉"], season: "夏",
      recipe: { amounts: ["ささみ 2本", "梅干し 1個", "大葉 3枚(細切り)", "酒 少々"],
        steps: ["ささみに酒を振り、耐熱皿に乗せてラップをして電子レンジで加熱する", "粗熱が取れたら手で細く裂く", "梅干しをつぶし、大葉と一緒に和える"] } },
    { name: "じゃがいもの粉ふき青のり", point: "水分を完全に飛ばすので弁当向き", ing: ["じゃがいも", "青のり", "塩"],
      recipe: { amounts: ["じゃがいも 2個", "青のり 小さじ1", "塩 少々"],
        steps: ["じゃがいもはひと口大に切り、柔らかくなるまで茹でる", "湯を捨て、再び鍋を弱火にかけて揺すりながら水分を飛ばす", "塩と青のりをまぶす"] } },
  ],
};

/* 現在の季節判定: 夏(6〜9月)は冬レシピを外し、冬(11〜3月)は夏レシピを外す */
function seasonInfo() {
  const m = new Date().getMonth() + 1;
  if (m >= 6 && m <= 9) return { label: "夏", exclude: "冬" };
  if (m >= 11 || m <= 3) return { label: "冬", exclude: "夏" };
  return { label: "春秋", exclude: null };
}

function pickRandom(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function buildPool(type, myRecipes) {
  const { exclude } = seasonInfo();
  const builtin = RECIPES[type].filter((r) => !exclude || r.season !== exclude);
  const typeJa = type === "main" ? "主菜" : type === "fish" ? "魚" : "副菜";
  const mine = (myRecipes || []).filter((r) => r.type === typeJa);
  return [...builtin, ...mine.map((r) => ({ name: r.name, point: r.point, ing: r.ing }))];
}

function generateMenu(myRecipes) {
  const mains = pickRandom(buildPool("main", myRecipes), 2).map((r) => ({ ...r, id: uid(), type: "主菜" }));
  const fish = pickRandom(buildPool("fish", myRecipes), 1).map((r) => ({ ...r, id: uid(), type: "魚", point: (r.point || "") + "(2食分)" }));
  const sides = pickRandom(buildPool("side", myRecipes), 4).map((r) => ({ ...r, id: uid(), type: "副菜" }));
  const menus = [...mains, ...fish, ...sides];
  const shopping = [...new Set(menus.flatMap((m) => m.ing || []))];
  return { menus, shopping };
}

/* ---------- 夜のメモ: 感情タグと手放しの言葉 ---------- */
const EMOTION_TAGS = ["疲れ", "もやもや", "イライラ", "不安", "緊張", "さみしさ", "達成感", "安堵", "感謝", "すっきり"];

const RELEASE_WORDS = [
  "今日のことは今日のもの。続きは明日のわたしに任せましょう",
  "ここに書いた分だけ、頭の中は軽くなっています",
  "全部に答えを出さなくていい夜です",
  "よくやった、で締めていい一日でした",
  "考えごとはいったん棚に置いて。棚は逃げません",
  "今夜は守られて眠るだけでいい時間です",
  "うまくいかなかった分は、伸びしろとして預けておきましょう",
  "気持ちは書いた時点で半分手放せています",
  "今日も一日、自分の持ち場を守りました",
  "深呼吸ひとつ分だけ、ゆっくりしましょう",
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/* ---------- 共通UIパーツ ---------- */
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    color: C.ink,
    fontFamily:
      '"Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif',
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 40,
  },
  card: {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.line}`,
    padding: 14,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: `1.5px solid ${C.line}`,
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 16,
    fontFamily: "inherit",
    background: "#FBFDFC",
    color: C.ink,
    outline: "none",
  },
  btn: {
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    background: C.accent,
    color: "#fff",
    cursor: "pointer",
  },
  btnGhost: {
    border: `1.5px solid ${C.line}`,
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    background: "#fff",
    color: C.accent,
    fontWeight: 600,
    cursor: "pointer",
  },
  chip: {
    display: "inline-block",
    background: C.accentSoft,
    color: C.accent,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
    marginRight: 6,
    marginBottom: 4,
  },
};

function Header({ title, emoji, onBack }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 16px 12px",
        position: "sticky",
        top: 0,
        background: C.bg,
        zIndex: 5,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          style={{
            ...S.btnGhost,
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 16,
            lineHeight: 1,
          }}
          aria-label="ホームへ戻る"
        >
          ←
        </button>
      )}
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        <span style={{ marginRight: 8 }}>{emoji}</span>
        {title}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: "center", color: C.sub, fontSize: 14, padding: "28px 0" }}>
      {text}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, fontSize: 14, padding: "10px 2px" }}>
      <span className="shizuku-drop">💧</span>
      {label}
    </div>
  );
}

/* ===================================================================
   🌱 吐き出す
   =================================================================== */
function DumpModule({ data, update, goSend }) {
  const [text, setText] = useState("");

  const add = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    update({ items: [...data.items, ...lines.map((l) => ({ id: uid(), text: l }))] });
    setText("");
  };

  const TARGETS = [
    { id: "grocery", emoji: "🛒", label: "買い出し" },
    { id: "shopping", emoji: "🛍", label: "お店" },
    { id: "online", emoji: "📦", label: "ネット" },
    { id: "work", emoji: "💊", label: "仕事" },
    { id: "travel", emoji: "✈️", label: "旅行" },
    { id: "night", emoji: "🌙", label: "夜メモ" },
  ];

  const send = (item, target) => {
    goSend({ ...item, module: target });
    update({ items: data.items.filter((i) => i.id !== item.id) });
  };

  const remove = (id) => update({ items: data.items.filter((i) => i.id !== id) });

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={S.card}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"頭に浮かんだことをそのまま。\n改行すると別々のメモになります"}
          rows={4}
          style={{ ...S.input, resize: "vertical" }}
        />
        <button onClick={add} style={{ ...S.btn, width: "100%", marginTop: 10 }}>追加する</button>
      </div>

      {data.items.length === 0 && <Empty text="まだメモはありません。まずは1行どうぞ" />}

      {data.items.map((i) => (
        <div key={i.id} style={S.card}>
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>{i.text}</div>
          <div style={{ fontSize: 11, color: C.sub, margin: "10px 0 6px" }}>タップで送る ↓</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TARGETS.map((t) => (
              <button
                key={t.id}
                onClick={() => send(i, t.id)}
                style={{ ...S.btnGhost, padding: "7px 10px", fontSize: 12 }}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => remove(i.id)}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 12, padding: "8px 0 0", cursor: "pointer" }}
          >
            削除
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===================================================================
   🍱 作り置きノート
   =================================================================== */
function MealModule({ data, update, sendToGrocery }) {
  const season = seasonInfo();

  const generate = () => {
    const { menus, shopping } = generateMenu(data.myRecipes);
    update({ ...data, menus, lastShopping: shopping });
  };

  const reroll = (m) => {
    const type = m.type === "主菜" ? "main" : m.type === "魚" ? "fish" : "side";
    const used = new Set(data.menus.map((x) => x.name));
    const candidates = buildPool(type, data.myRecipes).filter((r) => !used.has(r.name));
    if (!candidates.length) return;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    const replaced = {
      ...next,
      id: uid(),
      type: m.type,
      point: m.type === "魚" ? (next.point || "") + "(2食分)" : next.point,
    };
    const menus = data.menus.map((x) => (x.id === m.id ? replaced : x));
    const shopping = [...new Set(menus.flatMap((x) => x.ing || []))];
    update({ ...data, menus, lastShopping: shopping });
  };

  const saveMenu = (m) => {
    if (data.saved.some((s) => s.name === m.name)) return;
    update({ ...data, saved: [...data.saved, { ...m, id: uid() }] });
  };

  const typeColor = (t) =>
    t === "魚" ? "#3A6EA5" : t === "主菜" ? C.warn : C.accent;

  /* --- マイレシピ登録 --- */
  const [showMine, setShowMine] = useState(false);
  const [rName, setRName] = useState("");
  const [rType, setRType] = useState("副菜");
  const [rIng, setRIng] = useState("");
  const [rPoint, setRPoint] = useState("");

  const addMine = () => {
    if (!rName.trim()) return;
    const rec = {
      id: uid(),
      name: rName.trim(),
      type: rType,
      ing: rIng.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean),
      point: rPoint.trim(),
    };
    update({ ...data, myRecipes: [...data.myRecipes, rec] });
    setRName(""); setRIng(""); setRPoint("");
  };

  /* --- レシピ詳細の開閉 --- */
  const [openId, setOpenId] = useState(null);

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={S.card}>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, marginBottom: 10 }}>
          お弁当向け・水分が出にくい・魚は1種2食分・副菜4種以上。
          いまは<b style={{ color: C.ink }}>「{season.label}」</b>向けのレシピから組みます。
        </div>
        <button onClick={generate} style={{ ...S.btn, width: "100%" }}>
          {data.menus.length ? "ぜんぶ組み直す 🔀" : "献立を組む"}
        </button>
      </div>

      {data.menus.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: C.sub, margin: "4px 4px 8px" }}>
            今週の献立(タップで作り方 / 🔀で1品だけ変更 / ☆で保存)
          </div>
          {data.menus.map((m) => {
            const isOpen = openId === m.id;
            return (
              <div key={m.id} style={S.card}>
                <div
                  onClick={() => m.recipe && setOpenId(isOpen ? null : m.id)}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: m.recipe ? "pointer" : "default" }}
                >
                  <span style={{ ...S.chip, background: "#F4F1EC", color: typeColor(m.type), flexShrink: 0, marginTop: 2 }}>
                    {m.type}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {m.name}{m.recipe && <span style={{ color: C.sub, fontSize: 12, marginLeft: 6 }}>{isOpen ? "▲" : "▼ 作り方"}</span>}
                    </div>
                    {m.point && <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{m.point}</div>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); reroll(m); }} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer" }} aria-label="この1品を変える">
                    🔀
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); saveMenu(m); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }} aria-label="レシピ保存">
                    {data.saved.some((s) => s.name === m.name) ? "⭐" : "☆"}
                  </button>
                </div>

                {isOpen && m.recipe && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>材料(2人分目安)</div>
                    <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.8, marginBottom: 10 }}>
                      {m.recipe.amounts.map((a, i) => (
                        <div key={i}>・{a}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>作り方</div>
                    <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.8 }}>
                      {m.recipe.steps.map((s, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>{i + 1}. {s}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => sendToGrocery(data.lastShopping || [])}
            style={{ ...S.btn, width: "100%", marginTop: 4 }}
          >
            🛒 材料を買い物リストへ
          </button>
        </>
      )}

      {/* --- マイレシピ --- */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <button
          onClick={() => setShowMine(!showMine)}
          style={{ background: "none", border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: C.ink, cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}
        >
          📖 マイレシピ({data.myRecipes.length}品){showMine ? " ▲" : " ▼"}
        </button>
        {showMine && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 8 }}>
              定番の作り置きを登録すると、献立のシャッフルに混ざるようになります。
            </div>
            <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="料理名(例: 母直伝の五目豆)" style={S.input} />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["主菜", "魚", "副菜"].map((t) => (
                <button
                  key={t}
                  onClick={() => setRType(t)}
                  style={{
                    ...S.btnGhost, flex: 1, padding: "8px 0", fontSize: 13,
                    background: rType === t ? C.accentSoft : "#fff",
                    borderColor: rType === t ? C.accent : C.line,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <input value={rIng} onChange={(e) => setRIng(e.target.value)} placeholder="材料(読点か空白区切り: 大豆、にんじん)" style={{ ...S.input, marginTop: 8 }} />
            <input value={rPoint} onChange={(e) => setRPoint(e.target.value)} placeholder="コツ(任意)" style={{ ...S.input, marginTop: 8 }} />
            <button onClick={addMine} style={{ ...S.btn, width: "100%", marginTop: 10 }}>マイレシピに追加</button>

            {data.myRecipes.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ ...S.chip, background: "#F4F1EC", color: typeColor(r.type) }}>{r.type}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{r.name}</span>
                <button
                  onClick={() => update({ ...data, myRecipes: data.myRecipes.filter((x) => x.id !== r.id) })}
                  style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.saved.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: C.sub, margin: "16px 4px 8px" }}>⭐ 保存したレシピ</div>
          {data.saved.map((m) => (
            <div key={m.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ ...S.chip, background: "#F4F1EC", color: typeColor(m.type) }}>{m.type}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
              </div>
              <button
                onClick={() => update({ ...data, saved: data.saved.filter((s) => s.id !== m.id) })}
                style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
              >
                削除
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ===================================================================
   🛒 買い出しリスト
   =================================================================== */
function GroceryModule({ data, update }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    update({ items: [...data.items, { id: uid(), name: t, done: false }] });
    setText("");
  };
  const toggle = (id) =>
    update({ items: data.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) });
  const clearDone = () => update({ items: data.items.filter((i) => !i.done) });

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ ...S.card, display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="買うものを追加"
          style={{ ...S.input, flex: 1 }}
        />
        <button onClick={add} style={S.btn}>＋</button>
      </div>

      {data.items.length === 0 && <Empty text="リストは空です" />}

      {data.items.map((i) => (
        <div
          key={i.id}
          onClick={() => toggle(i.id)}
          style={{
            ...S.card,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            cursor: "pointer",
            opacity: i.done ? 0.45 : 1,
          }}
        >
          <span style={{ fontSize: 18 }}>{i.done ? "✅" : "⬜"}</span>
          <span style={{ fontSize: 15, textDecoration: i.done ? "line-through" : "none" }}>{i.name}</span>
        </div>
      ))}

      {data.items.some((i) => i.done) && (
        <button onClick={clearDone} style={{ ...S.btnGhost, width: "100%", marginTop: 6 }}>
          チェック済みをまとめて消す
        </button>
      )}
    </div>
  );
}

/* ===================================================================
   🌙 夜のメモ
   =================================================================== */
function NightModule({ data, update }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState([]);

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const write = () => {
    const t = text.trim();
    if (!t) return;
    const release = RELEASE_WORDS[Math.floor(Math.random() * RELEASE_WORDS.length)];
    update({
      entries: [
        { id: uid(), date: today(), text: t, emotions: tags, release },
        ...data.entries,
      ],
    });
    setText("");
    setTags([]);
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ ...S.card, background: C.night, border: "none" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今日あったこと、心に残っていること"
          rows={4}
          style={{ ...S.input, background: "#3A4A66", border: "none", color: "#EDF1F8", resize: "vertical" }}
        />
        <div style={{ fontSize: 12, color: "#AFC0DA", margin: "10px 2px 6px" }}>いまの気持ちに近いものは?(いくつでも)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EMOTION_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                background: tags.includes(t) ? "#7E93B8" : "#3A4A66",
                color: tags.includes(t) ? "#fff" : "#AFC0DA",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={write}
          style={{ ...S.btn, width: "100%", marginTop: 12, background: "#7E93B8" }}
        >
          書き出して手放す
        </button>
      </div>

      {data.entries.length === 0 && <Empty text="今夜の最初の1行をどうぞ" />}

      {data.entries.map((e) => (
        <div key={e.id} style={S.card}>
          <div style={{ fontSize: 12, color: C.sub }}>{e.date}</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 4, whiteSpace: "pre-wrap" }}>{e.text}</div>
          <div style={{ marginTop: 8 }}>
            {(e.emotions || []).map((t, i) => (
              <span key={i} style={{ ...S.chip, background: "#EAEDF5", color: C.night }}>{t}</span>
            ))}
          </div>
          {e.release && (
            <div style={{ fontSize: 14, color: C.night, marginTop: 8, fontWeight: 600, lineHeight: 1.6 }}>🌙 {e.release}</div>
          )}
          <button
            onClick={() => update({ entries: data.entries.filter((x) => x.id !== e.id) })}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 12, padding: "8px 0 0", cursor: "pointer" }}
          >
            削除
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===================================================================
   🛍 ショッピング / 📦 ネット購入(共通リスト型)
   =================================================================== */
function ShoppingModule({ data, update }) {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const add = () => {
    if (!name.trim()) return;
    update({ items: [...data.items, { id: uid(), name: name.trim(), store: store.trim(), done: false }] });
    setName(""); setStore("");
  };
  const stores = [...new Set(data.items.map((i) => i.store || "お店未定"))];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={S.card}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="欲しいもの" style={S.input} />
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="お店(任意)" style={{ ...S.input, marginTop: 8 }} />
        <button onClick={add} style={{ ...S.btn, width: "100%", marginTop: 10 }}>追加する</button>
      </div>

      {data.items.length === 0 && <Empty text="欲しいものを登録しましょう" />}

      {stores.map((st) => (
        <div key={st}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 4px 6px" }}>
            <span style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>📍 {st}</span>
            {st !== "お店未定" && (
              <a
                href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(st)}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: "none" }}
              >
                地図を開く →
              </a>
            )}
          </div>
          {data.items.filter((i) => (i.store || "お店未定") === st).map((i) => (
            <div
              key={i.id}
              style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", opacity: i.done ? 0.45 : 1 }}
            >
              <span style={{ fontSize: 18, cursor: "pointer" }} onClick={() => update({ items: data.items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x) })}>
                {i.done ? "✅" : "⬜"}
              </span>
              <span style={{ flex: 1, fontSize: 15, textDecoration: i.done ? "line-through" : "none" }}>{i.name}</span>
              <button
                onClick={() => update({ items: data.items.filter((x) => x.id !== i.id) })}
                style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const SITES = ["Amazon", "楽天", "Yahoo!", "その他"];

function OnlineModule({ data, update }) {
  const [name, setName] = useState("");
  const [site, setSite] = useState("Amazon");
  const add = () => {
    if (!name.trim()) return;
    update({ items: [...data.items, { id: uid(), name: name.trim(), site, done: false }] });
    setName("");
  };
  const used = SITES.filter((s) => data.items.some((i) => i.site === s));

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={S.card}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="買うもの" style={S.input} />
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {SITES.map((s) => (
            <button
              key={s}
              onClick={() => setSite(s)}
              style={{
                ...S.btnGhost,
                padding: "8px 12px",
                fontSize: 13,
                background: site === s ? C.accentSoft : "#fff",
                borderColor: site === s ? C.accent : C.line,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button onClick={add} style={{ ...S.btn, width: "100%", marginTop: 10 }}>追加する</button>
      </div>

      {data.items.length === 0 && <Empty text="ネットで買うものを登録しましょう" />}

      {used.map((s) => (
        <div key={s}>
          <div style={{ fontSize: 13, color: C.sub, fontWeight: 700, margin: "10px 4px 6px" }}>📦 {s}</div>
          {data.items.filter((i) => i.site === s).map((i) => (
            <div key={i.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", opacity: i.done ? 0.45 : 1 }}>
              <span style={{ fontSize: 18, cursor: "pointer" }} onClick={() => update({ items: data.items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x) })}>
                {i.done ? "✅" : "⬜"}
              </span>
              <span style={{ flex: 1, fontSize: 15, textDecoration: i.done ? "line-through" : "none" }}>{i.name}</span>
              <button
                onClick={() => update({ items: data.items.filter((x) => x.id !== i.id) })}
                style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ===================================================================
   💊 仕事
   =================================================================== */
const PRIORITIES = ["高", "中", "低"];
const PRIORITY_COLOR = { 高: "#C0633E", 中: "#C99A2E", 低: "#3D7C7A" };

function WorkModule({ data, update }) {
  const [tab, setTab] = useState("task");
  const [memo, setMemo] = useState("");
  const [title, setTitle] = useState("");
  const [pri, setPri] = useState("中");
  const [due, setDue] = useState("");

  const addMemo = () => {
    if (!memo.trim()) return;
    update({ ...data, memos: [{ id: uid(), text: memo.trim(), date: today() }, ...data.memos] });
    setMemo("");
  };
  const addTask = () => {
    if (!title.trim()) return;
    update({
      ...data,
      tasks: [...data.tasks, { id: uid(), title: title.trim(), pri, due, done: false }],
    });
    setTitle(""); setDue("");
  };

  const sorted = [...data.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const p = PRIORITIES.indexOf(a.pri) - PRIORITIES.indexOf(b.pri);
    if (p !== 0) return p;
    return (a.due || "9999").localeCompare(b.due || "9999");
  });

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[["task", "✅ タスク"], ["memo", "📝 クイックメモ"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              ...S.btnGhost,
              flex: 1,
              background: tab === k ? C.accentSoft : "#fff",
              borderColor: tab === k ? C.accent : C.line,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "memo" && (
        <>
          <div style={{ ...S.card, display: "flex", gap: 8 }}>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemo()}
              placeholder="さっとメモ"
              style={{ ...S.input, flex: 1 }}
            />
            <button onClick={addMemo} style={S.btn}>＋</button>
          </div>
          {data.memos.length === 0 && <Empty text="メモはまだありません" />}
          {data.memos.map((m) => (
            <div key={m.id} style={{ ...S.card, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{m.text}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{m.date}</div>
              </div>
              <button
                onClick={() => update({ ...data, memos: data.memos.filter((x) => x.id !== m.id) })}
                style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
              >
                削除
              </button>
            </div>
          ))}
        </>
      )}

      {tab === "task" && (
        <>
          <div style={S.card}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タスク名" style={S.input} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPri(p)}
                  style={{
                    ...S.btnGhost,
                    flex: 1,
                    padding: "8px 0",
                    fontSize: 13,
                    color: PRIORITY_COLOR[p],
                    background: pri === p ? C.accentSoft : "#fff",
                    borderColor: pri === p ? C.accent : C.line,
                  }}
                >
                  {p}
                </button>
              ))}
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                style={{ ...S.input, flex: 2, padding: "8px 10px", fontSize: 13 }}
              />
            </div>
            <button onClick={addTask} style={{ ...S.btn, width: "100%", marginTop: 10 }}>タスクを追加</button>
          </div>

          {sorted.length === 0 && <Empty text="タスクはありません。おつかれさまです" />}

          {sorted.map((t) => (
            <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", opacity: t.done ? 0.45 : 1 }}>
              <span
                style={{ fontSize: 18, cursor: "pointer" }}
                onClick={() => update({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x) })}
              >
                {t.done ? "✅" : "⬜"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                  <span style={{ color: PRIORITY_COLOR[t.pri], fontWeight: 700 }}>優先度 {t.pri}</span>
                  {t.due && <span> ・ 期限 {t.due.slice(5).replace("-", "/")}</span>}
                </div>
              </div>
              <button
                onClick={() => update({ ...data, tasks: data.tasks.filter((x) => x.id !== t.id) })}
                style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer" }}
              >
                削除
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ===================================================================
   ✈️ 旅行
   =================================================================== */
function TravelCard({ i, onPromote, onNote, onDelete }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...S.chip, background: i.area === "国内" ? C.accentSoft : "#EAEDF5", color: i.area === "国内" ? C.accent : C.night }}>
          {i.area}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{i.place}</span>
        {i.status === "wish" ? (
          <button onClick={() => onPromote(i.id)} style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13 }}>
            計画にする ↑
          </button>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: C.warn }}>🗓 計画中</span>
        )}
      </div>
      {i.status === "plan" && (
        <textarea
          value={i.note}
          onChange={(e) => onNote(i.id, e.target.value)}
          placeholder="日程・行きたい酒蔵・宿などのメモ"
          rows={2}
          style={{ ...S.input, marginTop: 10, fontSize: 14 }}
        />
      )}
      <button
        onClick={() => onDelete(i.id)}
        style={{ background: "none", border: "none", color: C.sub, fontSize: 12, padding: "8px 0 0", cursor: "pointer" }}
      >
        削除
      </button>
    </div>
  );
}

function TravelModule({ data, update }) {
  const [place, setPlace] = useState("");
  const [area, setArea] = useState("国内");

  const add = () => {
    if (!place.trim()) return;
    update({ items: [...data.items, { id: uid(), place: place.trim(), area, status: "wish", note: "" }] });
    setPlace("");
  };
  const promote = (id) =>
    update({ items: data.items.map((i) => (i.id === id ? { ...i, status: "plan" } : i)) });
  const setNote = (id, note) =>
    update({ items: data.items.map((i) => (i.id === id ? { ...i, note } : i)) });
  const remove = (id) =>
    update({ items: data.items.filter((x) => x.id !== id) });

  const plans = data.items.filter((i) => i.status === "plan");
  const wishes = data.items.filter((i) => i.status === "wish");

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={S.card}>
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="行きたい場所(例: 福井の酒蔵)" style={S.input} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {["国内", "海外"].map((a) => (
            <button
              key={a}
              onClick={() => setArea(a)}
              style={{
                ...S.btnGhost,
                flex: 1,
                background: area === a ? C.accentSoft : "#fff",
                borderColor: area === a ? C.accent : C.line,
              }}
            >
              {a}
            </button>
          ))}
          <button onClick={add} style={{ ...S.btn, flex: 1 }}>追加</button>
        </div>
      </div>

      {plans.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: C.sub, margin: "10px 4px 6px", fontWeight: 700 }}>🗓 計画中の旅</div>
          {plans.map((i) => <TravelCard key={i.id} i={i} onPromote={promote} onNote={setNote} onDelete={remove} />)}
        </>
      )}

      <div style={{ fontSize: 13, color: C.sub, margin: "10px 4px 6px", fontWeight: 700 }}>🌏 ウィッシュリスト</div>
      {wishes.length === 0 && <Empty text="行きたい場所を追加しましょう" />}
      {wishes.map((i) => <TravelCard key={i.id} i={i} onPromote={promote} onNote={setNote} onDelete={remove} />)}
    </div>
  );
}

/* ===================================================================
   メインアプリ
   =================================================================== */
export default function Shizuku() {
  const [screen, setScreen] = useState("home");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    loadAll().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  const updateModule = useCallback((modId, partial) => {
    setData((prev) => {
      const next = { ...prev, [modId]: { ...prev[modId], ...partial } };
      saveAll(next);
      return next;
    });
  }, []);

  /* 吐き出す → 各モジュールへ送る */
  const sendFromDump = (item) => {
    const text = item.text;
    setData((prev) => {
      const next = { ...prev };
      const m = item.module;
      if (m === "grocery") next.grocery = { items: [...prev.grocery.items, { id: uid(), name: text, done: false }] };
      else if (m === "shopping") next.shopping = { items: [...prev.shopping.items, { id: uid(), name: text, store: "", done: false }] };
      else if (m === "online") next.online = { items: [...prev.online.items, { id: uid(), name: text, site: "その他", done: false }] };
      else if (m === "work") next.work = { ...prev.work, memos: [{ id: uid(), text, date: today() }, ...prev.work.memos] };
      else if (m === "travel") next.travel = { items: [...prev.travel.items, { id: uid(), place: text, area: "国内", status: "wish", note: "" }] };
      else if (m === "night") next.night = { entries: [{ id: uid(), date: today(), text: item.text, emotions: [], comment: "", release: "" }, ...prev.night.entries] };
      else if (m === "meal") next.work = prev.work; // mealは生成型のため、メモはworkではなくdumpに残す
      saveAll(next);
      return next;
    });
  };

  const sendToGrocery = (names) => {
    if (!names || !names.length) return;
    setData((prev) => {
      const existing = new Set(prev.grocery.items.map((i) => i.name));
      const adds = names.filter((n) => !existing.has(n)).map((n) => ({ id: uid(), name: n, done: false }));
      const next = { ...prev, grocery: { items: [...prev.grocery.items, ...adds] } };
      saveAll(next);
      return next;
    });
    setScreen("grocery");
  };

  if (!data) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: C.sub }}>
          <div className="shizuku-drop" style={{ fontSize: 36 }}>💧</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>しずくを起動しています…</div>
        </div>
        <style>{dropCss}</style>
      </div>
    );
  }

  const mod = MODULES.find((m) => m.id === screen);

  return (
    <div style={S.page}>
      <style>{dropCss}</style>

      {screen === "home" ? (
        <>
          <div style={{ padding: "28px 20px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>💧</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.18em", marginTop: 4 }}>しずく</div>
            <div style={{ fontSize: 12, color: C.sub, letterSpacing: "0.3em", marginTop: 2 }}>shizuku</div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              padding: 16,
            }}
          >
            {MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => setScreen(m.id)}
                style={{
                  ...S.card,
                  textAlign: "left",
                  cursor: "pointer",
                  marginBottom: 0,
                  padding: "16px 14px",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 26 }}>{m.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: C.ink }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <Header title={mod.name} emoji={mod.emoji} onBack={() => setScreen("home")} />
          {screen === "dump" && (
            <DumpModule data={data.dump} update={(p) => updateModule("dump", p)} goSend={sendFromDump} />
          )}
          {screen === "meal" && (
            <MealModule data={data.meal} update={(p) => updateModule("meal", p)} sendToGrocery={sendToGrocery} />
          )}
          {screen === "grocery" && <GroceryModule data={data.grocery} update={(p) => updateModule("grocery", p)} />}
          {screen === "night" && <NightModule data={data.night} update={(p) => updateModule("night", p)} />}
          {screen === "shopping" && <ShoppingModule data={data.shopping} update={(p) => updateModule("shopping", p)} />}
          {screen === "online" && <OnlineModule data={data.online} update={(p) => updateModule("online", p)} />}
          {screen === "work" && <WorkModule data={data.work} update={(p) => updateModule("work", p)} />}
          {screen === "travel" && <TravelModule data={data.travel} update={(p) => updateModule("travel", p)} />}
        </>
      )}
    </div>
  );
}

const dropCss = `
@keyframes shizukuFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.shizuku-drop { display: inline-block; animation: shizukuFloat 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .shizuku-drop { animation: none; }
}
`;
