/*
 * This class provides a stub to implement the gold elements check. If there are no gold elements, the check is considered true automatically.
 * The following codes provides answers, notes and attributes for each gold element. Those three corresponding data structures should be used
 * to implement the check.
 */

export class GoldChecker {

  static performGoldCheck(goldConfiguration : Array<Object>) {

    let goldChecks = new Array<boolean>()

    /* If there are no gold elements there is nothing to be checked */
    if(goldConfiguration.length<=0) {
      goldChecks.push(true)
      return goldChecks
    }

    for (let goldElement of goldConfiguration) {

      /* Element attributes */
      let document = goldConfiguration["document"]
      /* Worker's answers for each gold dimensions */
      let answers = goldConfiguration["answers"]
      /* Worker's notes*/
      let notes = goldConfiguration["notes"]

      let goldCheck = false

      /* CONTROL IMPLEMENTATION STARTS HERE */
      /* Write your code; the check for the current element holds if goldCheck is set to true */

      let union = new Set()
      let intersection = new Set()
      notes.forEach(item => {
        if (item.option == "effect" && item.deleted == false) {
          let currentTextSet = new Set()
          let indexStart = item.index_start
          let indexEnd = item.index_end
          for (let i = indexStart; i < indexEnd; i++) currentTextSet.add(i)
          for (let span of document.adr_spans) {
            let currentAdrSet = new Set()
            let indexStart = span["start"]
            let indexEnd = span["end"]
            for (let i = indexStart; i < indexEnd; i++) currentAdrSet = currentAdrSet.add(i);
            for (let number of currentTextSet.values()) {
              union.add(number)
              if (currentAdrSet.has(number)) intersection.add(number)
            }
            for (let number of currentAdrSet.values()) {
              union.add(number)
              if (currentTextSet.has(number)) intersection.add(number)
            }
          }
        }
      });
      let jaccardCoefficient = intersection.size / union.size
      if (jaccardCoefficient >= 0.70) goldCheck = true

      /* CONTROL IMPLEMENTATION ENDS HERE */

      /* Push goldCheck inside goldChecks array for the current gold element */
      goldChecks.push(goldCheck)

    }

    return goldChecks

  }

}
