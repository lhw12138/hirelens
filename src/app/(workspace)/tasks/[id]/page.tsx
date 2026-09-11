import { GuidedTask } from "@/components/guided-task";
export default async function Page({params}:{params:Promise<{id:string}>}) { return <GuidedTask id={(await params).id}/>; }
