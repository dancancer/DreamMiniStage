新增文件

  hooks/useLocalStorage.ts (185行)

  提供的 API

  // 泛型版本 - 支持任意类型 (自动 JSON 序列化)
  const { value, setValue, remove } = useLocalStorage<User>("user", defaultUser);

  // 字符串专用 - 无 JSON 开销
  const { value, setValue } = useLocalStorageString("language", "zh");

  // 布尔值专用 - 自动处理 "true"/"false"
  const { value, setValue } = useLocalStorageBoolean("soundEnabled", false);

  // 数字专用 - 自动解析
  const { value, setValue } = useLocalStorageNumber("responseLength", 200);

  重构示例

  useResponseLength 已使用新 Hook：

  // 之前：手动处理 localStorage + useEffect + useState
  const [length, setLengthState] = useState(DEFAULT_LENGTH);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { ... }
  }, []);

  // 之后：一行搞定
  const { value, setValue } = useLocalStorageNumber(STORAGE_KEY, DEFAULT_LENGTH);

  潜在复用

  代码库中有 80+ 处 localStorage 调用可逐步迁移。