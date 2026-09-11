import { CandidateComparison } from "@/components/candidate-comparison";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <CandidateComparison id={(await params).id}/>; }
