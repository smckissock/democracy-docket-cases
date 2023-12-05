export class RowChart {

    
        constructor(facts, attribute, width, maxItems, updateFunction, dim, noUnspecified) {
            this.dim = dim ? dim : facts.dimension(dc.pluck(attribute));
            this.group = this.dim.group().reduceSum(dc.pluck("count"));
            if (noUnspecified)
                this.group = removeUnspecified(this.group);
    
            dc.rowChart("#chart-" + attribute)
                .dimension(this.dim)
                .group(this.group)
                .data(function (d) { return d.top(maxItems); })
                .width(width)
                .height(maxItems * 20)
                .margins({ top: 0, right: 10, bottom: 20, left: 10 })
                .elasticX(true)
                .ordinalColors(["#c6dbef"])  
                .label(d => `${d.key}  (${d.value.toLocaleString()})`)
                .labelOffsetX(5)
                .on('filtered', () => {
                    updateFunction()
                })
                .xAxis().ticks(4).tickFormat(d3.format(".2s"));
    
            // Note: if ever want to exclude something other than "Unspecified" we could change this to pass it in.
            function removeUnspecified(group) {
                let predicate = d => d.key !== "Unspecified";
    
                return {
                    all: function () {
                        return group.all().filter(d => predicate(d));
                    },
                    top: function(n) {
                        return group.top(Infinity)
                            .filter(predicate)
                            .slice(0, n);
                    }
                };
            }
        }
    
         // Note: if ever want to exclude something other than "Unspecified" we could change this to pass it in.
         removeUnspecified(group) {
    
            let predicate = d => d.key !== "Unspecified";
    
            return {
                all: function () {
                    return group.all().filter(d => predicate(d));
                },
                top: function(n) {
                    return group.top(Infinity)
                        .filter(predicate)
                        .slice(0, n);
                    }
            };
        }
    }