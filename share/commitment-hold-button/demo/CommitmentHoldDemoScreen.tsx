import { CommitmentHoldPledge } from '../src'

export default function CommitmentHoldDemoScreen() {
  return (
    <CommitmentHoldPledge
      name="Alex"
      coachMessage="One small ritual before the plan starts."
      completeCoachMessage="Locked in. Now we can build from here."
      pledgeText="commit to showing up, keeping promises to myself, and making progress one session at a time."
      accentColor="#F97316"
      backgroundColor="#0B0B0D"
      surfaceColor="#17171A"
      holdDurationMs={3000}
      onComplete={() => {
        console.log('Commitment completed')
      }}
      onContinue={() => {
        console.log('Continue pressed')
      }}
    />
  )
}
