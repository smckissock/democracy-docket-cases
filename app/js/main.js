export class Main {
   
    constructor() {
        this.getData();
    }

    async getData() {
        const [cases] = await Promise.all([
            d3.csv("/app/data/cases.csv")
        ]);

        console.log(cases);
    }
}

const main = new Main();
