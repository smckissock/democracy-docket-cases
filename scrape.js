const cheerio = require("cheerio");
const fs = require("fs"); //import { writeFile } from 'fs/promises';

let $;

// Escape a field for CSV: wrap in quotes and escape internal quotes
function csvEscape(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    // Escape double quotes by doubling them, then wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
}

function getPage(cases) {

    $(".archive-card").each((i, e) => {        
        let aCase = {};

        // state, stateImg 
        const $stateDiv = $(e).find(".archive-card__state");       
        const stateAlt = $($stateDiv).find("img").attr("alt");
        const stateSrc = $($stateDiv).find("img").attr("src");
        aCase.state = stateAlt ? stateAlt.replace("State of ", "").trim() : "";
        aCase.stateImg = stateSrc ? stateSrc.trim() : "";

        // Topics...
        const $caseDiv = $(e).find(".archive-card__main");
        const $caseTagUl = $($caseDiv).find(".post__list-tags");
        const $caseTagLis = $($caseTagUl).find("li");
        
        
        aCase.electionAdministration = false;
        aCase.felonyDisenfranchisement = false;
        aCase.inPersonVoting = false;
        aCase.postElectionLitigation = false;
        aCase.redistrictingLitigation = false;
        aCase.registration = false;
        aCase.trumpAccountability = false;
        aCase.voteByMail = false;
       
        aCase.victory = false;
        
        $caseTagLis.each((i, el) => {
            const tag = $(el).find("li a").text().trim().toUpperCase();
    
            switch (tag) {
                // Need to update in main.js too if new topics are added
                case "ELECTION ADMINISTRATION":
                    aCase.electionAdministration = true; break;
                case "FELONY DISENFRANCHISEMENT": {
                    console.log("Felony");
                    aCase.felonyDisenfranchisement = true; break;
                }
                case "IN-PERSON VOTING":
                    aCase.inPersonVoting = true; break;
                case "POST-ELECTION LITIGATION":
                    aCase.postElectionLitigation = true; break;
                case "REDISTRICTING LITIGATION":
                    aCase.redistrictingLitigation = true; break;
                case "REGISTRATION":
                    aCase.registration = true; break;
                case "TRUMP ACCOUNTABILITY":
                    aCase.trumpAccountability = true; break;
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

        // Default to "Victory" if no status tag was found
        if (!aCase.caseStatus) {
            aCase.caseStatus = "Victory";
        }
    
        aCase.parties = $(e).find("p.archive-card__parties").text().trim();                      

        const $excerptDiv = $(e).find("div.archive-card__excerpt");        
        aCase.excerpt = $($excerptDiv).find("p").text().trim();
  
        const $titleH2 = $(e).find("h2.archive-card__title");
        aCase.title = $($titleH2).find("a").text().trim();
        const caseHref = $($titleH2).find("a").attr("href");
        aCase.href = caseHref ? caseHref.trim() : "";

        const $metaDiv = $(e).find("div.archive-card__meta");
        const $datePs = $($metaDiv).find(".archive-card__meta p");

        $datePs.each((i, el) => {            
            if (i == 0) 
                aCase.dateFiled = $(el).find("time").attr("datetime");
            if (i == 1) 
                aCase.dateDecided = $(el).find("time").attr("datetime");
        });

        // Add case details
        // fetchPage(aCase.href)
        // .then((text) => {
        //     $ = cheerio.load(text);
        //     console.log(aCase.href);
        // });

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

    let pages = 0;
    await fetchPage("https://www.democracydocket.com/cases")
        .then((text) => {
            $ = cheerio.load(text);
            pages = parseInt($('.archive__pag-num-total').text());
            console.log(`${pages} pages with case listings`);
        });

    console.log(`Getting cases for ${pages } pages..`);    
    // pages = 2;  // For testing

    for (i = 1; i <= pages; i++) {
        let url = '';  
        
        if (i == 1)
            url = `https://www.democracydocket.com/cases/`;
        else        
            url = `https://www.democracydocket.com/cases/page/${i}`;

        await fetchPage(url)
        .then((text) => {
            $ = cheerio.load(text);
            cases = getPage(cases)
            console.log(`PAGE: ${i},  CASES:  ${cases.length}`);
        });
    }

    // Gets case details, but it doesn't do anything with them yet
    // for (i = 0; i < cases.length; i++) {
    //     var aCase = cases[i]
    //     await fetchPage(aCase.href)
    //     .then((text) => {
    //         $ = cheerio.load(text);
    //         console.log("GOT " + aCase.href);
    //     });
    // };

    let csvStrings = [`state,stateImg,parties,title,href,dateFiled,dateDecided,excerpt,electionAdministration,felonyDisenfranchisement,inPersonVoting,postElectionLitigation,redistrictingLitigation,registration,trumpAccountability,voteByMail,victory,caseStatus`];
    cases.forEach(d => {
        csvStrings.push(
            `${csvEscape(d.state)},${csvEscape(d.stateImg)},${csvEscape(d.parties)},${csvEscape(d.title)},${csvEscape(d.href)},${d.dateFiled},${d.dateDecided},${csvEscape(d.excerpt)},${d.electionAdministration},${d.felonyDisenfranchisement},${d.inPersonVoting},${d.postElectionLitigation},${d.redistrictingLitigation},${d.registration},${d.trumpAccountability},${d.voteByMail},${d.victory},${d.caseStatus}`);
    })
    const csvData = csvStrings.join('\n');

    fs.writeFile('app/data/cases.csv', csvData, 'utf8', (err) => {
        if (err) {
            console.error("Failed to write CSV:", err.message);
        } else {
            console.log("Done");
        }
    });
}


scrape();


