// 已确认的联赛裁定；原网站排名和原始GW得分保持独立。
window.LEAGUE_RULES = {
  disqualified: {3: [14]},
  swaps: {2: [[28, 4]], 6: [[20, 12]]}
};
function scoringOrder(week, originalOrders, rules = window.LEAGUE_RULES) {
  const order = originalOrders[week - 1].filter(id => !(rules.disqualified[week] || []).includes(id));
  for (const [a,b] of rules.swaps[week] || []) {
    const ai=order.indexOf(a),bi=order.indexOf(b);
    if(ai<0||bi<0)throw Error('裁定中的车手未找到');
    [order[ai],order[bi]]=[order[bi],order[ai]];
  }
  return order;
}
