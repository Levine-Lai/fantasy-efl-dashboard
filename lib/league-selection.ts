export const leagueOptions = [{value:"10",label:"英冠"},{value:"11",label:"英甲"},{value:"12",label:"英乙"},{value:"10,11",label:"英冠 + 英甲"},{value:"10,12",label:"英冠 + 英乙"},{value:"11,12",label:"英甲 + 英乙"},{value:"ALL",label:"总计"}];
export function includesLeague(selection: string, id: number) { return selection === "ALL" || selection.split(",").includes(String(id)); }
export function leagueLabel(selection: string) { return leagueOptions.find(option=>option.value===selection)?.label ?? "总计"; }
