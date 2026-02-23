/**
 * Shared utilities for Democracy Docket Stories
 */

export const biasColors = {
    'Right': '#fc8181',
    'Center Right': '#feb2b2',
    'Center': '#a0aec0',
    'Unspecified': '#a0aec0',
    'Center Left': '#90cdf4',
    'Left': '#3182ce'
};

// Format date as "January 1, 2022"
export function formatDate(date, includeDayOfWeek = false) {
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = [
        'January', 'February', 'March',
        'April', 'May', 'June', 'July',
        'August', 'September', 'October',
        'November', 'December'
    ];

    // Use UTC methods to avoid timezone shift
    const day = date.getUTCDate();
    const monthIndex = date.getUTCMonth();
    const year = date.getUTCFullYear();

    const rslt = monthNames[monthIndex] + ' ' + day + ', ' + year;

    if (!includeDayOfWeek)
        return rslt;
    else
        return daysOfWeek[date.getUTCDay()] + ', ' + rslt;
}

// Add commas to numbers: 123456789 -> '123,456,789'
export function addCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Smooth scroll to top of a container
export function scrollToTop(divId) {
    d3.select(divId)
        .transition()
        .duration(750)
        .tween('scrollTop', function() {
            let node = this;
            let i = d3.interpolateNumber(node.scrollTop, 0);
            return function(t) { node.scrollTop = i(t); };
        });
}

// Slugify a string
export function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}
