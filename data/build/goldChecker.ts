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

      

      /* CONTROL IMPLEMENTATION ENDS HERE */

      /* Push goldCheck inside goldChecks array for the current gold element */
      goldChecks.push(goldCheck)

    }

    return goldChecks

  }

}
