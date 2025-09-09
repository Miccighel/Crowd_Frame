export class GoldChecker {

    // @ts-ignore TS6133: intentionally unused – user will implement logic.
    static performGoldCheck(goldConfiguration: Array<Object>, taskType =
    null) {

        let goldChecks = new Array<boolean>()

        /* If there are no gold elements, there is nothing to be checked */
        if (goldConfiguration.length <= 0) {
            goldChecks.push(true)
            return goldChecks
        }

        let answerTruthLow = null
        let answerTruthHigh = null

        let answerLengthLow = null
        let answerLengthMedium = null
        let answerLengthHigh = null

        for (let goldElement of goldConfiguration) {

            /* Element attributes */
            // @ts-ignore TS6133: intentionally unused – user will implement logic.
            let document = goldElement["document"]
            /* Worker's answers for each gold dimension */
            // @ts-ignore TS6133: intentionally unused – user will implement logic.
            let answers = goldElement["answers"]
            /* Worker's notes*/
            // @ts-ignore TS6133: intentionally unused – user will implement logic.
            let notes = goldElement["notes"]

            let goldCheck = true

            /* CONTROL IMPLEMENTATION STARTS HERE */
            /* Write your code; the check for the current element holds if
            goldCheck remains set to true */

            if (document['id'] == 'GOLD_LOW') answerTruthLow = answers
            if (document['id'] == 'GOLD_HIGH') answerTruthHigh = answers

            if (document['id'] == 'GOLD_LINE_LOW') answerLengthLow = answers
            if (document['id'] == 'GOLD_LINE_MEDIUM') answerLengthMedium = answers
            if (document['id'] == 'GOLD_LINE_HIGH') answerLengthHigh = answers

            /* CONTROL IMPLEMENTATION ENDS HERE */
            /* Push goldCheck inside goldChecks array for the current gold
            element */
            goldChecks.push(goldCheck)

        }

        let goldCheck = false
        if (taskType == "Training") {
            if ((answerLengthLow['length_value'] < answerLengthMedium['length_value']) && (answerLengthMedium['length_value'] < answerLengthHigh['length_value']))
                goldCheck = true
        } else {
            if (answerTruthLow['truthfulness_value'] < answerTruthHigh['truthfulness_value'])
                goldCheck = true
        }

        goldChecks.push(goldCheck)

        return goldChecks

    }

}
