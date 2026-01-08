import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

import { StorageConstruct } from "../constructs/storage-construct";

export class TodoAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "TodoVpc", {
      maxAzs: 2,
      natGateways: 1
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, "TodoCluster", { vpc });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, "TodoAlb", {
      vpc,
      internetFacing: true
    });

    const listener = alb.addListener("Http", {
      port: 80,
      open: true
    });

    // Storage
    const storage = new StorageConstruct(this, "Storage");

    // ---------------------------
    // BACKEND (Express)
    // ---------------------------
    const backendLogGroup = new logs.LogGroup(this, "BackendLogs", {
      retention: logs.RetentionDays.ONE_WEEK
    });

    const backendTaskRole = new iam.Role(this, "BackendTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
    });

    storage.table.grantReadWriteData(backendTaskRole);

    const backendTaskDef = new ecs.FargateTaskDefinition(this, "BackendTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole: backendTaskRole
    });

    const backendContainer = backendTaskDef.addContainer("BackendContainer", {
      image: ecs.ContainerImage.fromAsset("../backend", {
        platform: Platform.LINUX_AMD64
      }), // <-- IMPORTANT
      logging: ecs.LogDrivers.awsLogs({ logGroup: backendLogGroup, streamPrefix: "backend" }),
      environment: {
        PORT: "4000",
        AWS_REGION: this.region,
        DDB_TABLE: storage.table.tableName,
        USE_LOCALSTACK: "false"
      }
    });

    backendContainer.addPortMappings({ containerPort: 4000 });

    const backendService = new ecs.FargateService(this, "BackendService", {
      cluster,
      taskDefinition: backendTaskDef,
      desiredCount: 1,
      assignPublicIp: false
    });

    const backendTg = new elbv2.ApplicationTargetGroup(this, "BackendTg", {
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendService],
      healthCheck: { path: "/api/health", healthyHttpCodes: "200" }
    });

    // Route /api/* -> backend
    listener.addTargetGroups("BackendRule", {
      priority: 10,
      targetGroups: [backendTg],
      conditions: [elbv2.ListenerCondition.pathPatterns(["/api/*"])]
    });

    new cdk.CfnOutput(this, "AppUrl", {
      value: `http://${alb.loadBalancerDnsName}`
    });
  }
}
