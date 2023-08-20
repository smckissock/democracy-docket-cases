const cheerio = require("cheerio");
const fs = require("fs"); //import { writeFile } from 'fs/promises';


async function scrape() {
    
    const resp = await fetch("https://www.democracydocket.com/cases/");
    const text = await resp.text();

    const $ = cheerio.load(text);

    const cases = [];    
    //const cases = $(".archive-card").each((i, e) => {
    $(".archive-card").each((i, e) => {

        // state, stateImg 
        const $stateDiv = $(e).find(".archive-card__state");
        const state = $($stateDiv).find("img").attr("alt").replace("State of ", "").trim();
        const stateImg = $($stateDiv).find("img").attr("src").trim();

        // Topics...
        const $caseDiv = $(e).find(".archive-card__main");
        const $caseTagUl = $($caseDiv).find(".post__list-tags");
        const $caseTagLis = $($caseTagUl).find("li");

        $caseTagLis.each((i, el) => {
            const tag = $(el).find("li a").text().trim();
            //console.log(tag);
        });
        
        //console.log($caseTagLis.length)
        //const $topicLi = $($caseTagLis).find("li:first").text();
        //const $topic = $($topicLi).find("a");

        // Parties
        const parties = $(e).find("p.archive-card__parties").text().trim();
                
        // Excerpt
        const $excerptDiv = $(e).find("div.archive-card__excerpt")
        const excerpt = $($excerptDiv).find("p").text().trim();
       

        const $metaDiv = $(e).find("div.archive-card__meta");
        const $datePs = $($metaDiv).find(".archive-card__meta p");

        let dateFiled = "";
        let dateDecided = "";
        $datePs.each((i, el) => {            
            if (i == 0) 
                dateFiled = $(el).find("time").attr("datetime");
            if (i == 1) 
                dateDecided = $(el).find("time").attr("datetime");
        });
        
        cases.push({
            state,
            stateImg,
            dateFiled,
            dateDecided,
            parties,
            excerpt,
        })
        
    });

    //console.log(items.length)
    //console.log(items[0])
   
    let csvStrings = [`state,stateImg,parties,dateFiled,dateDecided,excerpt`];
    cases.forEach(d => {
        csvStrings.push(`${d.state},${d.stateImg},"${d.parties}",${d.dateFiled},${d.dateDecided},"${d.excerpt }"`);
    })
    const csvData = csvStrings.join('\n');

    fs.writeFile('cases.csv', csvData, 'utf8', () => console.log("Done"));
}


scrape();
