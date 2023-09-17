const cheerio = require("cheerio");
const fs = require("fs"); //import { writeFile } from 'fs/promises';

let $;

function getPage(cases) {

    $(".archive-card").each((i, e) => {        
        let aCase = {};

        // state, stateImg 
        const $stateDiv = $(e).find(".archive-card__state");       
        aCase.state = $($stateDiv).find("img").attr("alt").replace("State of ", "").trim();
        aCase.stateImg = $($stateDiv).find("img").attr("src").trim();

        // Topics...
        const $caseDiv = $(e).find(".archive-card__main");
        const $caseTagUl = $($caseDiv).find(".post__list-tags");
        const $caseTagLis = $($caseTagUl).find("li");
        
        
        aCase.electionAdministration = false;
        aCase.inPersonVoting = false;
        aCase.postElectionLitigation = false;
        aCase.redistrictingLitigation = false;
        aCase.registration = false;
        aCase.voteByMail = false;
        
        aCase.victory = false;
        
        $caseTagLis.each((i, el) => {
            const tag = $(el).find("li a").text().trim().toUpperCase();
    
            aCase.victory = tag === "VICTORY"; 
            switch (tag) {
                case "ELECTION ADMINISTRATION":
                    aCase.electionAdministration = true; break;
                case "IN-PERSON VOTING":
                    aCase.inPersonVoting = true; break;
                case "POST-ELECTION LITIGATION":
                    aCase.postElectionLitigation = true; break;
                case "REDISTRICTING LITIGATION":
                    aCase.redistrictingLitigation = true; break;
                case "REGISTRATION":
                    aCase.registration = true; break;
                case "VOTE BY MAIL":
                    aCase.voteByMail = true; break;

                case "VICTORY":
                    aCase.victory = true; break;
            }
            
            if (tag === "APPEALED")
                aCase.caseStatus = "Appealed";
            if (tag === "DECIDED")
                aCase.caseStatus = "Decided";
            if (tag === "FILED")
                aCase.caseStatus = "Filed";
        });
    
        aCase.parties = $(e).find("p.archive-card__parties").text().trim();                      

        const $excerptDiv = $(e).find("div.archive-card__excerpt");        
        aCase.excerpt = $($excerptDiv).find("p").text().trim();
  
        const $metaDiv = $(e).find("div.archive-card__meta");
        const $datePs = $($metaDiv).find(".archive-card__meta p");

        $datePs.each((i, el) => {            
            if (i == 0) 
                aCase.dateFiled = $(el).find("time").attr("datetime");
            if (i == 1) 
                aCase.dateDecided = $(el).find("time").attr("datetime");
        });

        cases.push(aCase);      
    });
    return cases;
};


async function fetchPage(url) {    
    const resp = await fetch(url);
    const text = await resp.text();

    return text;
    $ = cheerio.load(text);
}


async function scrape() {    
    let cases = [];

    const PAGES = 64;

    for (i = 2; i <= PAGES; i++) {
        let url = "https://www.democracydocket.com/cases";
        if (i > 1)
            url = `https://www.democracydocket.com/cases/page/${i}`;

        await fetchPage(url)
        .then((text) => {
            $ = cheerio.load(text);
            cases = getPage(cases)
            console.log("CASES " + cases.length);
        });
    }
        
    let csvStrings = [`state,stateImg,parties,dateFiled,dateDecided,excerpt,electionAdministration,inPersonVoting,postElectionLitigation,redistrictingLitigation,registration,voteByMail,victory,caseStatus`];
    cases.forEach(d => {
        csvStrings.push(
            `${d.state},${d.stateImg},"${d.parties}",${d.dateFiled},${d.dateDecided},"${d.excerpt }",${d.electionAdministration},${d.inPersonVoting},${d.postElectionLitigation},${d.redistrictingLitigation},${d.registration},${d.voteByMail},${d.victory},${d.caseStatus}`);
    })
    const csvData = csvStrings.join('\n');

    fs.writeFile('app/data/cases.csv', csvData, 'utf8', () => console.log("Done"));
}


scrape();

