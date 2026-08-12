# Prompt Shelf for SillyTavern

SillyTavern의 Chat Completion 프리셋을 이름과 버전별로 정리하고 빠르게 전환하는 UI 확장입니다. 기존 프리셋 데이터는 건드리지 않고, 기본 프리셋 선택기 위에 별도의 선반을 추가합니다.

## 주요 기능

- `감성 프롬프트 13.2`, `감성 프롬프트 v14`, `감성 프롬프트 (rev 15)`처럼 끝에 붙은 버전을 자동 인식
- 버전을 제거한 이름의 유사도를 계산해 같은 계열을 자동 그룹화
- 사용자가 직접 그룹을 만들고 자동 분류 결과를 덮어쓰기
- 최신 버전부터 정렬하고 현재 사용 중인 프리셋을 강조
- 2~8개의 퀵 프롬프트 슬롯에 현재 프리셋을 저장해 원터치 전환
- 검색, 그룹 필터, 접기/펼치기 및 모바일 반응형 UI
- 설정과 사용자 그룹은 SillyTavern 확장 설정에 저장

## 설치

SillyTavern에서 **Extensions → Install Extension**을 열고 아래 주소를 붙여 넣습니다.

```text
https://github.com/gakumasu1717-cloud/prpt.git
```

설치 후 **AI Response Configuration → Chat Completion Presets** 위에 Prompt Shelf가 나타납니다. 보이지 않으면 페이지를 한 번 새로고침하세요.

## 사용법

1. 퀵 슬롯의 핀 버튼을 누르면 현재 선택된 프리셋이 해당 슬롯에 저장됩니다.
2. 저장된 슬롯의 이름 영역을 누르면 해당 프리셋으로 즉시 전환됩니다.
3. **그룹 관리**를 누르면 새 그룹을 만들고 각 버전 옆 선택 상자에서 그룹을 지정할 수 있습니다.
4. Extensions 패널의 Prompt Shelf 설정에서 자동 그룹화, 유사도, 슬롯 수를 조절할 수 있습니다.

그룹 유사도를 높이면 이름이 거의 같은 프리셋만 묶이고, 낮추면 표기가 조금 다른 이름도 같은 계열로 묶입니다.

## 호환성과 데이터

- 최신 SillyTavern의 `SillyTavern.getContext()`와 `data-preset-manager-for="openai"` 프리셋 선택기를 사용합니다.
- 프리셋 JSON을 복사하거나 변경하지 않습니다. 이 확장을 제거해도 원본 프리셋은 그대로 남습니다.
- 프리셋 이름을 바꾸면 해당 이름에 연결한 사용자 그룹과 퀵 슬롯은 다시 지정해야 합니다.

## 개발 확인

```bash
npm test
npm run check
```

## License

MIT
