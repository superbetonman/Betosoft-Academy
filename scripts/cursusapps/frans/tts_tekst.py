import json,re,sys
def uitspraak(t):
    t=t.replace("m³"," mètres cubes").replace("C25/30","C vingt-cinq trente").replace("LMRA","L.M.R.A.").replace("BB-P36","B.B. P trente-six").replace("BB-07","B.B. zéro sept")
    t=re.sub(r"\bS(\d)\b",r"S \1",t); t=t.replace("EPI","É.P.I.").replace("RGPT","R.G.P.T.").replace("BENOR","Bénor").replace("H · É · E · P · O","")
    t=re.sub(r"(\d) h (\d\d)",r"\1 heures \2",t); t=t.replace(" · ",", ")
    t=t.replace("BetonCentrale","Betoncentrale"); t=re.sub(r"([a-zàâçéèêëîïôûùüÿœ])([A-ZÀÉÈÊ])",r"\1. \2",t)
    t=re.sub(r"\s+"," ",t).strip().replace("A..","A.").replace("T..","T.").replace("I..","I.")
    if not re.search(r"[.!?:»]$",t): t+="."
    return t
if __name__=="__main__":
    o=json.load(open('voix-orde.json'))
    les=sys.argv[1]
    print("\n\n".join(uitspraak(t) for _,t in o[les]))
