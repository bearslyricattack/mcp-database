#!/usr/bin/env node
"use strict";
/**
 * PostgreSQL 数据库创建器 MCP 服务器
 *
 * 配置示例:
 * {
 *   "mcpServers": {
 *     "database-creator": {
 *       "command": "node",
 *       "args": ["path/to/this/script.js", "/path/to/kubeconfig"]
 *     }
 *   }
 * }
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
// 默认命名空间
// 默认的请求头
const HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json"
};
// 创建一个HTTPS代理以忽略SSL证书验证
const httpsAgent = new https_1.default.Agent({
    rejectUnauthorized: false
});
// 解析 kubeconfig 文件
function parseKubeConfig(filePath) {
    try {
        const configFile = fs_1.default.readFileSync(filePath, 'utf8');
        const config = js_yaml_1.default.load(configFile);
        // 获取当前上下文
        const currentContextName = config["current-context"];
        // 查找上下文
        const contextObj = config.contexts.find((ctx) => ctx.name === currentContextName);
        if (!contextObj) {
            throw new Error(`找不到上下文: ${currentContextName}`);
        }
        const contextConfig = contextObj.context;
        // 查找集群
        const clusterObj = config.clusters.find((cls) => cls.name === contextConfig.cluster);
        if (!clusterObj) {
            throw new Error(`找不到集群: ${contextConfig.cluster}`);
        }
        const cluster = clusterObj.cluster;
        // 查找用户
        const userObj = config.users.find((u) => u.name === contextConfig.user);
        if (!userObj) {
            throw new Error(`找不到用户: ${contextConfig.user}`);
        }
        const user = userObj.user;
        // 提取 API 服务器 URL
        const apiServer = cluster.server;
        // 提取令牌或客户端证书
        let token = '';
        if (user.token) {
            token = user.token;
        }
        else if (user['token-file']) {
            token = fs_1.default.readFileSync(path_1.default.resolve(user['token-file']), 'utf8').trim();
        }
        else if (user.exec) {
            // 暂不支持 exec 认证
            throw new Error('不支持 exec 认证方式');
        }
        // 提取 CA 证书
        let caCert;
        if (cluster['certificate-authority']) {
            caCert = fs_1.default.readFileSync(path_1.default.resolve(cluster['certificate-authority']));
        }
        else if (cluster['certificate-authority-data']) {
            caCert = Buffer.from(cluster['certificate-authority-data'], 'base64');
        }
        // 从上下文中获取命名空间
        const namespace = contextConfig.namespace || 'default';
        return {
            apiServer,
            token,
            caCert,
            namespace
        };
    }
    catch (err) {
        console.error('解析 kubeconfig 文件失败:', err);
        throw err;
    }
}
// 获取 kubeconfig 路径
const args = process.argv.slice(2);
const kubeconfigPath = args[0] || process.env.KUBECONFIG || path_1.default.join(process.env.HOME || '', '.kube', 'config');
// 加载 kubeconfig
let kubeConfig;
try {
    console.error(`正在加载 kubeconfig: ${kubeconfigPath}`);
    kubeConfig = parseKubeConfig(kubeconfigPath);
    console.error(`成功加载 kubeconfig, API 服务器: ${kubeConfig.apiServer}`);
}
catch (err) {
    console.error('加载 kubeconfig 失败, 将使用默认配置:', err);
    // 使用默认配置
    kubeConfig = {
        apiServer: "https://192.168.10.35.nip.io:6443",
        token: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii1lbUFrRmNVdmkzemlvYUFtWHpEV3FualNXU2ZZY2F6SlZieGk3TXA5NzgifQ.eyJhdWQiOlsiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwiXSwiZXhwIjoxNzQwNDcxMDE0LCJpYXQiOjE3NDA0Njc0MTQsImlzcyI6Imh0dHBzOi8va3ViZXJuZXRlcy5kZWZhdWx0LnN2Yy5jbHVzdGVyLmxvY2FsIiwia3ViZXJuZXRlcy5pbyI6eyJuYW1lc3BhY2UiOiJucy1rdnM0YmI5ayIsInNlcnZpY2VhY2NvdW50Ijp7Im5hbWUiOiJ0ZXN0LWRiIiwidWlkIjoiZTc2MTE0NzMtODgyOC00MGYzLWEzODItMjM2YmI0NGIyNzg2In19LCJuYmYiOjE3NDA0Njc0MTQsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpucy1rdnM0YmI5azp0ZXN0LWRiIn0.pCaVLqdXaDwW2897brdyqd_13J-4dXsFJJaVJn34trQR9yp6ILjyv8mnbB6lVvcxAQb-KVzh0ZNd8mB7xAN7PapwZcH4VMGQitN8ZbK18wEc2uHXu-_J5Z258w1kNzah1UKM8MEe6LyWY9FPno_xJrXIveidXcEOnMNDp2GUk3vLGTJXil5_MH4kgNprjsLjHQZ6dLZX5gqkJc4rCqadjquC1X89va9VXUIS25PJtig3zV3KWn1pSSBMGkQw6O_3ZkfntRLyAEo4xMIqiTigBUjUpojYQlSUM2GN1hKSjWKoRjmXFzGaf49Sucj83tupWX2W22K6nzPEjH6gju2mcw",
        namespace: "default"
    };
}
const server = new index_js_1.Server({
    name: "database-creator",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(void 0, void 0, void 0, function* () {
    return {
        tools: [
            {
                name: "create_postgresql",
                description: "创建新的PostgreSQL数据库集群。",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "数据库集群名称" },
                        namespace: { type: "string", description: "部署的命名空间", default: kubeConfig.namespace },
                        token: { type: "string", description: "Kubernetes API认证令牌（可选，默认使用kubeconfig中的令牌）" },
                        cpu_limit: { type: "string", description: "CPU资源限制", default: "1000m" },
                        memory_limit: { type: "string", description: "内存资源限制", default: "1024Mi" },
                        cpu_request: { type: "string", description: "CPU资源请求", default: "100m" },
                        memory_request: { type: "string", description: "内存资源请求", default: "102Mi" },
                        storage: { type: "string", description: "存储大小", default: "3Gi" }
                    },
                    required: ["name"]
                }
            },
            {
                name: "get_postgresql_clusters",
                description: "获取指定命名空间中的PostgreSQL集群列表。",
                inputSchema: {
                    type: "object",
                    properties: {
                        namespace: { type: "string", description: "要查询的命名空间", default: kubeConfig.namespace },
                        token: { type: "string", description: "Kubernetes API认证令牌（可选，默认使用kubeconfig中的令牌）" }
                    }
                }
            },
            {
                name: "delete_postgresql_cluster",
                description: "删除指定的PostgreSQL集群。",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "要删除的数据库集群名称" },
                        namespace: { type: "string", description: "集群所在的命名空间", default: kubeConfig.namespace },
                        token: { type: "string", description: "Kubernetes API认证令牌（可选，默认使用kubeconfig中的令牌）" }
                    },
                    required: ["name"]
                }
            }
        ],
    };
}));
server.setRequestHandler(types_js_1.CallToolRequestSchema, (request) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (request.params.name === "create_postgresql") {
        const { name, namespace = kubeConfig.namespace, token = "", cpu_limit = "1000m", memory_limit = "1024Mi", cpu_request = "100m", memory_request = "102Mi", storage = "3Gi" } = request.params.arguments;
        try {
            // 创建 ServiceAccount
            const sa_endpoint = `${kubeConfig.apiServer}/api/v1/namespaces/${namespace}/serviceaccounts`;
            const sa_payload = {
                apiVersion: "v1",
                kind: "ServiceAccount",
                metadata: {
                    name: name,
                    labels: {
                        "sealos-db-provider-cr": name,
                        "app.kubernetes.io/instance": name,
                        "app.kubernetes.io/managed-by": "kbcli"
                    }
                }
            };
            // 创建 Role
            const role_endpoint = `${kubeConfig.apiServer}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles`;
            const role_payload = {
                apiVersion: "rbac.authorization.k8s.io/v1",
                kind: "Role",
                metadata: {
                    name: name,
                    labels: {
                        "sealos-db-provider-cr": name,
                        "app.kubernetes.io/instance": name,
                        "app.kubernetes.io/managed-by": "kbcli"
                    }
                },
                rules: [
                    {
                        apiGroups: ["*"],
                        resources: ["*"],
                        verbs: ["*"]
                    }
                ]
            };
            // 创建 RoleBinding
            const rb_endpoint = `${kubeConfig.apiServer}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`;
            const rb_payload = {
                apiVersion: "rbac.authorization.k8s.io/v1",
                kind: "RoleBinding",
                metadata: {
                    name: name,
                    labels: {
                        "sealos-db-provider-cr": name,
                        "app.kubernetes.io/instance": name,
                        "app.kubernetes.io/managed-by": name
                    }
                },
                roleRef: {
                    apiGroup: "rbac.authorization.k8s.io",
                    kind: "Role",
                    name: name
                },
                subjects: [
                    {
                        kind: "ServiceAccount",
                        name: name
                    }
                ]
            };
            const headers = Object.assign(Object.assign({}, HEADERS), { "Authorization": `Bearer ${token || kubeConfig.token}` });
            // 创建所有资源
            yield axios_1.default.post(sa_endpoint, sa_payload, { headers, httpsAgent });
            yield axios_1.default.post(role_endpoint, role_payload, { headers, httpsAgent });
            yield axios_1.default.post(rb_endpoint, rb_payload, { headers, httpsAgent });
            // 等待一会儿让 ServiceAccount 的 token 生成
            yield new Promise(resolve => setTimeout(resolve, 1000));
            // 修改 PostgreSQL 集群配置中的 serviceAccountName
            const payload = {
                "apiVersion": "apps.kubeblocks.io/v1alpha1",
                "kind": "Cluster",
                "metadata": {
                    "finalizers": [
                        "cluster.kubeblocks.io/finalizer"
                    ],
                    "labels": {
                        "clusterdefinition.kubeblocks.io/name": "postgresql",
                        "clusterversion.kubeblocks.io/name": "postgresql-14.8.0",
                        "sealos-db-provider-cr": name
                    },
                    "name": name,
                    "namespace": namespace
                },
                "spec": {
                    "affinity": {
                        "nodeLabels": {},
                        "podAntiAffinity": "Preferred",
                        "tenancy": "SharedNode",
                        "topologyKeys": [
                            "kubernetes.io/hostname"
                        ]
                    },
                    "clusterDefinitionRef": "postgresql",
                    "clusterVersionRef": "postgresql-14.8.0",
                    "componentSpecs": [
                        {
                            "componentDefRef": "postgresql",
                            "monitor": true,
                            "name": "postgresql",
                            "replicas": 1,
                            "resources": {
                                "limits": {
                                    "cpu": cpu_limit,
                                    "memory": memory_limit
                                },
                                "requests": {
                                    "cpu": cpu_request,
                                    "memory": memory_request
                                }
                            },
                            "serviceAccountName": name,
                            "switchPolicy": {
                                "type": "Noop"
                            },
                            "volumeClaimTemplates": [
                                {
                                    "name": "data",
                                    "spec": {
                                        "accessModes": [
                                            "ReadWriteOnce"
                                        ],
                                        "resources": {
                                            "requests": {
                                                "storage": storage
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    ],
                    "terminationPolicy": "Delete",
                    "tolerations": []
                }
            };
            // 继续原有的创建集群逻辑
            const api_endpoint = `${kubeConfig.apiServer}/apis/apps.kubeblocks.io/v1alpha1/namespaces/${namespace}/clusters`;
            // 发送POST请求到Kubernetes API
            const response = yield axios_1.default.post(api_endpoint, payload, {
                headers: Object.assign(Object.assign({}, HEADERS), { "Authorization": `Bearer ${token || kubeConfig.token}` }),
                httpsAgent
            });
            if ([200, 201, 202].includes(response.status)) {
                return {
                    content: [{ type: "text", text: `成功创建PostgreSQL集群 '${name}'，响应状态码: ${response.status}` }],
                    isError: false,
                };
            }
            else {
                return {
                    content: [{ type: "text", text: `创建PostgreSQL集群失败，状态码: ${response.status}，错误信息: ${JSON.stringify(response.data)}` }],
                    isError: true,
                };
            }
        }
        catch (e) {
            if (axios_1.default.isAxiosError(e) && e.response) {
                return {
                    content: [{ type: "text", text: `创建PostgreSQL集群失败，状态码: ${e.response.status}，错误信息: ${JSON.stringify(e.response.data)}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: "text", text: `发送API请求时发生错误: ${e instanceof Error ? e.message : String(e)}` }],
                isError: true,
            };
        }
    }
    else if (request.params.name === "get_postgresql_clusters") {
        const { namespace = kubeConfig.namespace, token = "" } = request.params.arguments;
        // API端点URL
        const api_endpoint = `${kubeConfig.apiServer}/apis/apps.kubeblocks.io/v1alpha1/namespaces/${namespace}/clusters`;
        // 添加认证令牌到请求头
        const headers = Object.assign(Object.assign({}, HEADERS), { "Authorization": `Bearer ${token || kubeConfig.token}` });
        try {
            // 发送GET请求到Kubernetes API
            const response = yield axios_1.default.get(api_endpoint, {
                headers: headers,
                httpsAgent
            });
            if (response.status === 200) {
                const clusters = response.data;
                const items = clusters.items || [];
                // 格式化输出集群信息
                let result = `在命名空间 '${namespace}' 中找到 ${items.length} 个PostgreSQL集群:\n\n`;
                for (const cluster of items) {
                    const name = ((_a = cluster.metadata) === null || _a === void 0 ? void 0 : _a.name) || '未知';
                    const status = ((_b = cluster.status) === null || _b === void 0 ? void 0 : _b.phase) || '未知';
                    const created = ((_c = cluster.metadata) === null || _c === void 0 ? void 0 : _c.creationTimestamp) || '未知';
                    result += `- 集群名称: ${name}\n`;
                    result += `  状态: ${status}\n`;
                    result += `  创建时间: ${created}\n\n`;
                }
                return {
                    content: [{ type: "text", text: result }],
                    isError: false,
                };
            }
            else {
                return {
                    content: [{ type: "text", text: `获取PostgreSQL集群列表失败，状态码: ${response.status}，错误信息: ${JSON.stringify(response.data)}` }],
                    isError: true,
                };
            }
        }
        catch (e) {
            if (axios_1.default.isAxiosError(e) && e.response) {
                return {
                    content: [{ type: "text", text: `获取PostgreSQL集群列表失败，状态码: ${e.response.status}，错误信息: ${JSON.stringify(e.response.data)}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: "text", text: `发送API请求时发生错误: ${e instanceof Error ? e.message : String(e)}` }],
                isError: true,
            };
        }
    }
    else if (request.params.name === "delete_postgresql_cluster") {
        const { name, namespace = kubeConfig.namespace, token = "" } = request.params.arguments;
        // API端点URL
        const api_endpoint = `${kubeConfig.apiServer}/apis/apps.kubeblocks.io/v1alpha1/namespaces/${namespace}/clusters/${name}`;
        // 添加认证令牌到请求头
        const headers = Object.assign(Object.assign({}, HEADERS), { "Authorization": `Bearer ${token || kubeConfig.token}` });
        try {
            // 发送DELETE请求到Kubernetes API
            const response = yield axios_1.default.delete(api_endpoint, {
                headers: headers,
                httpsAgent
            });
            if ([200, 202, 204].includes(response.status)) {
                return {
                    content: [{ type: "text", text: `成功删除PostgreSQL集群 '${name}'，响应状态码: ${response.status}` }],
                    isError: false,
                };
            }
            else {
                return {
                    content: [{ type: "text", text: `删除PostgreSQL集群失败，状态码: ${response.status}，错误信息: ${JSON.stringify(response.data)}` }],
                    isError: true,
                };
            }
        }
        catch (e) {
            if (axios_1.default.isAxiosError(e) && e.response) {
                return {
                    content: [{ type: "text", text: `删除PostgreSQL集群失败，状态码: ${e.response.status}，错误信息: ${JSON.stringify(e.response.data)}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: "text", text: `发送API请求时发生错误: ${e instanceof Error ? e.message : String(e)}` }],
                isError: true,
            };
        }
    }
    throw new Error(`未知工具: ${request.params.name}`);
}));
/**
 * 初始化并运行服务器
 *
 * 此服务器通过标准输入/输出进行通信，适合作为MCP服务器运行
 * 配置方式见文件顶部的注释
 */
function runServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.error("PostgreSQL 数据库创建器服务启动中...");
            const transport = new stdio_js_1.StdioServerTransport();
            yield server.connect(transport);
            console.error("服务器已连接，等待请求...");
        }
        catch (err) {
            console.error("服务器启动错误:", err);
            process.exit(1);
        }
    });
}
// 作为主模块运行时启动服务器
if (require.main === module) {
    runServer();
}
