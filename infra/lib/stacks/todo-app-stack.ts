import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { StorageConstruct } from "../constructs/storage-construct";

export class TodoAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "TodoVpc", { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, "TodoCluster", { vpc });

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true
    });

    alb.addListener("Http", { port: 80, open: true });

    new StorageConstruct(this, "Storage");
  }
}
