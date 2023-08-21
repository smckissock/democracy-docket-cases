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
        $caseTagLis.each((i, el) => {
            const tag = $(el).find("li a").text().trim();
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

    const PAGES = 7; //64;

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
        
    let csvStrings = [`state,stateImg,parties,dateFiled,dateDecided,excerpt`];
    cases.forEach(d => {
        csvStrings.push(`${d.state},${d.stateImg},"${d.parties}",${d.dateFiled},${d.dateDecided},"${d.excerpt }"`);
    })
    const csvData = csvStrings.join('\n');

    fs.writeFile('cases.csv', csvData, 'utf8', () => console.log("Done"));
}


scrape();
